import SwiftUI
import WidgetKit

// The "Up next" widget for the Home Screen and the Lock Screen. The app writes a snapshot of the coming week
// (src/lib/widget.ts) into the App Group named in Info.plist ("AppGroup"); the widget works out what to show at
// each moment from it, so it stays right while the app is closed. Every word on it comes from the app, already in
// the user's language.

// MARK: - Data from the app

struct WidgetItem: Codable {
    let title: String
    let start: Double
    let end: Double?
    let kind: String
    let allDay: Bool?
    let detail: String?
    let color: String
}

struct LeaveTime: Codable {
    let at: Double
    let classAt: Double
    let title: String
}

struct Labels: Codable {
    let upNext: String
    let leaveBy: String
    let due: String
    let nothing: String
    let now: String
    let today: String
    let tomorrow: String
    let exam: String
}

struct Snapshot: Codable {
    let v: Int
    let updated: Double
    let items: [WidgetItem]
    let leave: [LeaveTime]
    let labels: Labels
}

extension Date {
    init(ms: Double) { self.init(timeIntervalSince1970: ms / 1000) }
    var ms: Double { timeIntervalSince1970 * 1000 }
}

enum Store {
    static func load() -> Snapshot? {
        guard
            let group = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String,
            let json = UserDefaults(suiteName: group)?.string(forKey: "widget"),
            let data = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }
}

extension Snapshot {
    /// Shown in the widget gallery before the app has written anything.
    static var sample: Snapshot {
        let now = Date()
        let hour = 3_600_000.0
        return Snapshot(
            v: 1, updated: now.ms,
            items: [
                WidgetItem(title: "Statistics", start: now.ms + hour, end: now.ms + 2.5 * hour, kind: "class", allDay: nil, detail: "Room 204", color: "#30b350"),
                WidgetItem(title: "Essay draft", start: now.ms + 5 * hour, end: nil, kind: "assignment", allDay: nil, detail: nil, color: "#0a84ff"),
                WidgetItem(title: "Physics exam", start: now.ms + 26 * hour, end: nil, kind: "exam", allDay: nil, detail: nil, color: "#ff453a"),
            ],
            leave: [],
            labels: Labels(upNext: "Up next", leaveBy: "Leave by {time}", due: "Due {time}", nothing: "Nothing coming up", now: "Now", today: "Today", tomorrow: "Tomorrow", exam: "Exam")
        )
    }

    /// What matters at `date`: the leave-by time for the next trip, and everything not over yet.
    func moment(at date: Date) -> (leave: LeaveTime?, upcoming: [WidgetItem]) {
        let now = date.ms
        let dayStart = Calendar.current.startOfDay(for: date).ms
        let upcoming = items.filter { ($0.allDay ?? false) ? $0.start >= dayStart : ($0.end ?? $0.start) > now }
        // From the evening before until the class starts (also while running late).
        let leave = leave.first { $0.classAt > now && $0.at - now <= 16 * 3_600_000 }
        return (leave, upcoming)
    }
}

// MARK: - Timeline

struct Entry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), snapshot: .sample) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), snapshot: Store.load() ?? (context.isPreview ? .sample : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let now = Date()
        let snapshot = Store.load()
        let horizon = now.addingTimeInterval(24 * 3600)
        var times: Set<Date> = [now]
        func add(_ ms: Double?) {
            guard let ms else { return }
            let d = Date(ms: ms)
            if d > now && d < horizon { times.insert(d) }
        }
        // A new entry whenever something starts or ends, so the widget moves on by itself.
        snapshot?.items.forEach { add($0.start); add($0.end) }
        snapshot?.leave.forEach { add($0.at); add($0.classAt) }
        // At midnight "Tomorrow" becomes today.
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime) {
            times.insert(midnight)
        }
        let entries = times.sorted().prefix(60).map { Entry(date: $0, snapshot: snapshot) }
        let refresh = max(entries.last?.date ?? now, now.addingTimeInterval(3600))
        completion(Timeline(entries: Array(entries), policy: .after(refresh)))
    }
}

// MARK: - Text

extension Color {
    init(hex: String) {
        let value = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x0A84FF
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

private let deadlineKinds: Set<String> = ["assignment", "quiz", "task"]

func timeText(_ ms: Double) -> String {
    Date(ms: ms).formatted(date: .omitted, time: .shortened)
}

/// "10:00", "Now", "Due 23:59", "Tomorrow 09:00", "Fri 12:00", "Today" (all-day).
func whenText(_ item: WidgetItem, labels: Labels, at now: Date) -> String {
    let date = Date(ms: item.start)
    let calendar = Calendar.current
    let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: date)).day ?? 0
    let day: String? = days <= 0 ? nil : days == 1 ? labels.tomorrow : date.formatted(.dateTime.weekday(.abbreviated))
    if item.allDay ?? false { return day ?? labels.today }
    let deadline = deadlineKinds.contains(item.kind)
    if !deadline && date <= now { return labels.now }
    let time = timeText(item.start)
    let base = deadline ? labels.due.replacingOccurrences(of: "{time}", with: time) : time
    return day.map { "\($0) \(base)" } ?? base
}

func leaveText(_ leave: LeaveTime, labels: Labels) -> String {
    labels.leaveBy.replacingOccurrences(of: "{time}", with: timeText(leave.at))
}

// MARK: - Views

struct Bar: View {
    let color: String
    var body: some View {
        Capsule().fill(Color(hex: color)).frame(width: 4)
    }
}

/// The one thing that matters most right now: when to leave, or the next item.
struct Headline: View {
    let snapshot: Snapshot
    let date: Date

    var body: some View {
        let m = snapshot.moment(at: date)
        let labels = snapshot.labels
        VStack(alignment: .leading, spacing: 3) {
            Text(labels.upNext.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            if let leave = m.leave {
                Text(leaveText(leave, labels: labels))
                    .font(.headline)
                    .foregroundColor(Color(hex: "#0a84ff"))
                    .minimumScaleFactor(0.8)
                Text(leave.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Text(timeText(leave.classAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if let item = m.upcoming.first {
                Text(whenText(item, labels: labels, at: date))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color(hex: item.color))
                Text(item.kind == "exam" && !item.title.localizedCaseInsensitiveContains(labels.exam) ? "\(labels.exam): \(item.title)" : item.title)
                    .font(.headline)
                    .lineLimit(3)
                if let detail = item.detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Text(labels.nothing)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct Row: View {
    let item: WidgetItem
    let labels: Labels
    let date: Date

    var body: some View {
        HStack(spacing: 8) {
            Bar(color: item.color).frame(height: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(whenText(item, labels: labels, at: date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }
}

struct WidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        if let snapshot = entry.snapshot {
            content(snapshot)
        } else {
            // The app hasn't written anything yet.
            Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "")
                .font(.headline)
                .widgetBackground(clear: isAccessory)
        }
    }

    private var isAccessory: Bool {
        family == .accessoryRectangular || family == .accessoryInline
    }

    @ViewBuilder
    private func content(_ snapshot: Snapshot) -> some View {
        let m = snapshot.moment(at: entry.date)
        let labels = snapshot.labels
        switch family {
        case .accessoryInline:
            Group {
                if let leave = m.leave {
                    Text(leaveText(leave, labels: labels))
                } else if let item = m.upcoming.first {
                    Text("\(whenText(item, labels: labels, at: entry.date)) \(item.title)")
                } else {
                    Text(labels.nothing)
                }
            }
            .widgetBackground(clear: true)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                if let leave = m.leave {
                    Text(leaveText(leave, labels: labels)).font(.headline)
                    Text(leave.title).lineLimit(1)
                    Text(timeText(leave.classAt)).foregroundStyle(.secondary)
                } else if let item = m.upcoming.first {
                    Text(whenText(item, labels: labels, at: entry.date)).font(.headline)
                    Text(item.title).lineLimit(2)
                } else {
                    Text(labels.nothing).lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetBackground(clear: true)
        case .systemMedium:
            HStack(alignment: .top, spacing: 14) {
                Headline(snapshot: snapshot, date: entry.date)
                let shown = m.leave == nil ? Array(m.upcoming.dropFirst().prefix(3)) : Array(m.upcoming.prefix(3))
                if !shown.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(shown.enumerated()), id: \.offset) { _, item in
                            Row(item: item, labels: labels, date: entry.date)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .widgetBackground(clear: false)
        default:
            Headline(snapshot: snapshot, date: entry.date)
                .widgetBackground(clear: false)
        }
    }
}

extension View {
    @ViewBuilder
    func widgetBackground(clear: Bool) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) {
                if clear { Color.clear } else { Color(UIColor.systemBackground) }
            }
        } else if clear {
            self
        } else {
            padding().background(Color(UIColor.systemBackground))
        }
    }
}

// MARK: - Widget

struct UpNextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "UpNext", provider: Provider()) { entry in
            WidgetView(entry: entry)
        }
        .configurationDisplayName("Up next")
        .description("Your next class, when to leave and what's due.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct AppWidgets: WidgetBundle {
    var body: some Widget {
        UpNextWidget()
    }
}
