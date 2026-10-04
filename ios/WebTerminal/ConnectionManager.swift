import Foundation
import Network
import CryptoKit
import WebKit

/// Picks the server address: at home, straight to the box on the LAN (no
/// Cloudflare round trip); anywhere else, the public URL. The LAN address is
/// only used after it proves it is *this* server — it signs a random nonce
/// with a key the app fetched earlier over the authenticated public URL — so
/// on another network, where the same IP is someone else's machine, the app
/// never talks to it. See /api/lan-key and /api/lan-proof in server.js.
final class ConnectionManager {
    static let shared = ConnectionManager()
    static let networkChanged = Notification.Name("WTNetworkChanged")

    private let monitor = NWPathMonitor()
    private var debounce: DispatchWorkItem?

    private init() {
        monitor.pathUpdateHandler = { [weak self] _ in
            DispatchQueue.main.async {
                self?.debounce?.cancel()
                let work = DispatchWorkItem { NotificationCenter.default.post(name: Self.networkChanged, object: nil) }
                self?.debounce = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
            }
        }
        monitor.start(queue: .main)
    }

    private var lanKey: String? {
        get { UserDefaults.standard.string(forKey: "lan_key") }
        set { UserDefaults.standard.set(newValue, forKey: "lan_key") }
    }

    /// The address to use right now.
    func chooseBase() async -> URL {
        if let fixed = Preferences.overrideURL { return fixed }
        if Preferences.lanEnabled, let lan = Preferences.lanURL, await verified(lan) { return lan }
        return Preferences.publicURL
    }

    /// Fetch the LAN key over the public URL, using the web view's cookies
    /// (Cloudflare Access session). Called once the public page has loaded.
    func ensureKey(cookies store: WKHTTPCookieStore) async {
        guard lanKey == nil, Preferences.lanEnabled, Preferences.overrideURL == nil else { return }
        let base = Preferences.publicURL
        let cookies = await store.allCookies().filter { c in
            guard let host = base.host else { return false }
            let d = c.domain.hasPrefix(".") ? String(c.domain.dropFirst()) : c.domain
            return host == d || host.hasSuffix("." + d)
        }
        var req = URLRequest(url: base.appendingPathComponent("api/lan-key"), timeoutInterval: 8)
        HTTPCookie.requestHeaderFields(with: cookies).forEach { req.setValue($1, forHTTPHeaderField: $0) }
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let key = obj["key"] as? String, key.count == 64 else { return }
        lanKey = key
    }

    private lazy var probeSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 0.9
        cfg.timeoutIntervalForResource = 1.2
        cfg.waitsForConnectivity = false
        return URLSession(configuration: cfg)
    }()

    private func verified(_ lan: URL) async -> Bool {
        guard let keyHex = lanKey, let keyData = Data(hex: keyHex) else { return false }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return false }
        let nonce = bytes.map { String(format: "%02x", $0) }.joined()
        var comps = URLComponents(url: lan.appendingPathComponent("api/lan-proof"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "n", value: nonce)]
        guard let url = comps.url,
              let (data, resp) = try? await probeSession.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let proof = obj["proof"] as? String else { return false }
        let mac = HMAC<SHA256>.authenticationCode(for: Data(nonce.utf8), using: SymmetricKey(data: keyData))
        let expected = Data(mac).map { String(format: "%02x", $0) }.joined()
        return proof == expected
    }
}

private extension Data {
    init?(hex: String) {
        guard hex.count % 2 == 0 else { return nil }
        var out = Data(capacity: hex.count / 2)
        var i = hex.startIndex
        while i < hex.endIndex {
            let j = hex.index(i, offsetBy: 2)
            guard let b = UInt8(hex[i..<j], radix: 16) else { return nil }
            out.append(b)
            i = j
        }
        self = out
    }
}
