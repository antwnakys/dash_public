import UIKit
import Capacitor
import WidgetKit
import EventKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = DashViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// unidash's page colour (`--bg` in src/index.css), light and dark. Everything native behind the web page uses it,
/// so nothing dark shows behind the Dynamic Island, during overscroll or while the page loads.
private let dashBackground = UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 11 / 255, green: 11 / 255, blue: 13 / 255, alpha: 1)
        : UIColor(red: 242 / 255, green: 242 / 255, blue: 240 / 255, alpha: 1)
}

/// The Capacitor screen, edge to edge, in unidash's colours.
class DashViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(DashThemePlugin())
        bridge?.registerPluginInstance(WidgetDataPlugin())
        bridge?.registerPluginInstance(DeviceCalendarPlugin())
        view.backgroundColor = dashBackground
        guard let webView = webView else { return }
        webView.backgroundColor = dashBackground
        webView.scrollView.backgroundColor = dashBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = dashBackground
        }
        // iOS 26 draws a dimmed, blurred "edge effect" (with a divider line) under the status bar and at the
        // bottom of every scroll view. unidash fills the whole screen and fades its own content, so switch it off.
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            webView.scrollView.topEdgeEffect.isHidden = true
            webView.scrollView.bottomEdgeEffect.isHidden = true
        }
        #endif
    }
}

/// Lets the web app tell iOS which theme it shows (it can differ from the phone's setting),
/// so the native colours and the status bar text match.
@objc(DashThemePlugin)
class DashThemePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "DashThemePlugin"
    let jsName = "DashTheme"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    /// `style`: "light", "dark" or "system" (follow the phone's setting).
    @objc func set(_ call: CAPPluginCall) {
        let style: UIUserInterfaceStyle
        switch call.getString("style") {
        case "dark": style = .dark
        case "light": style = .light
        default: style = .unspecified
        }
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = style
            call.resolve()
        }
    }
}

/// Hands the widget its snapshot (src/lib/widget.ts): stored in the App Group named in Info.plist ("AppGroup"),
/// which the widget extension reads, then the widgets are asked to redraw.
@objc(WidgetDataPlugin)
class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WidgetDataPlugin"
    let jsName = "WidgetData"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        guard
            let json = call.getString("json"),
            let group = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String,
            let defaults = UserDefaults(suiteName: group)
        else {
            call.reject("No widget storage")
            return
        }
        defaults.set(json, forKey: "widget")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

/// Reads this iPhone's calendars (Apple Calendar and every account added in iOS Settings), read-only, for
/// src/data/deviceCalendar.ts. Nothing is written to the calendars and nothing leaves the phone from here.
@objc(DeviceCalendarPlugin)
class DeviceCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "DeviceCalendarPlugin"
    let jsName = "DeviceCalendar"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "events", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]
    private let store = EKEventStore()

    override public func load() {
        // Calendar edits in other apps: tell the page, which reads again.
        NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: store, queue: .main) { [weak self] _ in
            self?.notifyListeners("change", data: [:])
        }
    }

    /// "granted", "prompt" (not asked yet) or "denied" (refused, restricted, or add-only access).
    private func access() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            if status == .fullAccess { return "granted" }
            if status == .writeOnly { return "denied" }
        } else if status == .authorized {
            return "granted"
        }
        return status == .notDetermined ? "prompt" : "denied"
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["status": access()])
    }

    @objc func request(_ call: CAPPluginCall) {
        let done: (Bool, Error?) -> Void = { [weak self] _, _ in
            call.resolve(["status": self?.access() ?? "denied"])
        }
        if #available(iOS 17.0, *) {
            store.requestFullAccessToEvents(completion: done)
        } else {
            store.requestAccess(to: .event, completion: done)
        }
    }

    @objc func events(_ call: CAPPluginCall) {
        guard access() == "granted" else {
            call.reject("No calendar access")
            return
        }
        let now = Date().timeIntervalSince1970 * 1000
        let from = Date(timeIntervalSince1970: (call.getDouble("from") ?? now) / 1000)
        let to = Date(timeIntervalSince1970: (call.getDouble("to") ?? now + 180 * 86_400_000) / 1000)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            // Birthdays come from Contacts and would fill every day; holidays stay (they mark days off).
            let calendars = self.store.calendars(for: .event).filter { $0.type != .birthday }
            let predicate = self.store.predicateForEvents(withStart: from, end: to, calendars: calendars)
            let list: [[String: Any]] = self.store.events(matching: predicate)
                .filter { $0.status != .canceled }
                .prefix(3000)
                .map { e in
                    let base = e.eventIdentifier ?? e.calendarItemIdentifier
                    var item: [String: Any] = [
                        // One repeating event has one identifier for all its occurrences, so the start makes each unique.
                        "id": "\(base)@\(Int(e.startDate.timeIntervalSince1970))",
                        "series": e.calendarItemExternalIdentifier ?? e.calendarItemIdentifier,
                        "title": e.title ?? "",
                        "start": e.startDate.timeIntervalSince1970 * 1000,
                        "end": e.endDate.timeIntervalSince1970 * 1000,
                        "allDay": e.isAllDay,
                    ]
                    if let location = e.location, !location.isEmpty { item["location"] = location }
                    if let notes = e.notes, !notes.isEmpty { item["notes"] = String(notes.prefix(4000)) }
                    if let url = e.url?.absoluteString { item["url"] = url }
                    return item
                }
            call.resolve(["events": list])
        }
    }

    /// unidash's page in iPhone Settings, where calendar access can be turned back on.
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }
}
