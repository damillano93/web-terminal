import UIKit
import WebKit
import ObjectiveC

/// A WKWebView whose keyboard has no input accessory bar (the ‹ › ✓ strip Safari
/// shows above the keyboard). The bar belongs to WKWebView's private content view,
/// so give that one view instance a runtime subclass whose `inputAccessoryView`
/// is nil. Only this view is affected; nothing global is swizzled.
final class AccessoryFreeWebView: WKWebView {
    private static let subclassName = "WTNoAccessoryContentView"

    override func didMoveToWindow() {
        super.didMoveToWindow()
        hideInputAccessory()
    }

    private func hideInputAccessory() {
        guard let content = scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else { return }
        let base: AnyClass = type(of: content)
        if NSStringFromClass(base) == Self.subclassName { return }

        let subclass: AnyClass
        if let existing = NSClassFromString(Self.subclassName) {
            subclass = existing
        } else {
            guard let made = objc_allocateClassPair(base, Self.subclassName, 0) else { return }
            let block: @convention(block) (AnyObject) -> AnyObject? = { _ in nil }
            let imp = imp_implementationWithBlock(block)
            let sel = #selector(getter: UIResponder.inputAccessoryView)
            let types = method_getTypeEncoding(class_getInstanceMethod(UIView.self, sel)!)
            class_addMethod(made, sel, imp, types)
            objc_registerClassPair(made)
            subclass = made
        }
        object_setClass(content, subclass)
    }
}
