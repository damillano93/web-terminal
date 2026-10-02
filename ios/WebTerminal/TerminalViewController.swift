import UIKit
import WebKit

/// Full-screen WKWebView on the web-terminal. What it adds over Safari / the PWA:
/// no keyboard accessory bar (‹ › ✓), no browser chrome or rubber-banding, a
/// native clipboard bridge for OSC 52, and links that leave the app open in Safari.
final class TerminalViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!
    private let background = UIColor(red: 0x0d / 255, green: 0x11 / 255, blue: 0x17 / 255, alpha: 1)

    private var serverURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "WTServerURL") as? String
        return URL(string: raw ?? "") ?? URL(string: "https://terminal.example.com/")!
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        // Persistent store: the Cloudflare Access and app cookies survive restarts.
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        // The page checks for this handler and sends OSC 52 copies here instead
        // of going through navigator.clipboard.
        config.userContentController.add(WeakScriptHandler(self), name: "wtClipboard")
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__WT_NATIVE__ = { platform: 'ios', version: 1 };",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = AccessoryFreeWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = nil
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = background
        webView.load(URLRequest(url: serverURL))
    }

    // MARK: Hardware keyboard: reload with Cmd+R (Safari would have offered it).

    override var keyCommands: [UIKeyCommand]? {
        [UIKeyCommand(title: "Recargar", action: #selector(reload), input: "r", modifierFlags: [.command, .shift])]
    }

    @objc private func reload() { webView.reload() }

    // MARK: Clipboard bridge

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "wtClipboard", let text = message.body as? String {
            UIPasteboard.general.string = text
        }
    }

    // MARK: Navigation: stay on the terminal and its login; everything else opens in Safari.

    private func isInternal(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return true }   // about:blank, blob:, data:
        if host == serverURL.host?.lowercased() { return true }
        return host.hasSuffix(".cloudflareaccess.com")                 // Cloudflare Access login
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        if action.targetFrame?.isMainFrame == false || isInternal(url) {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // window.open(..., "_blank") — terminal links (Cmd/Ctrl+click) and "new window".
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if isInternal(url) { webView.load(URLRequest(url: url)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    // Blob downloads (Export pane as HTML) are offered through the share sheet.
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {}

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showRetry(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showRetry(error) }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    private func showRetry(_ error: Error) {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        let alert = UIAlertController(title: "No se pudo conectar",
                                      message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Reintentar", style: .default) { [weak self] _ in
            guard let self else { return }
            self.webView.load(URLRequest(url: self.serverURL))
        })
        present(alert, animated: true)
    }

    // JS alert/confirm/prompt (tab rename uses prompt()).
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}

/// WKUserContentController retains its handlers; this breaks the cycle.
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
