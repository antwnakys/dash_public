import UIKit
import Capacitor
import WidgetKit

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
