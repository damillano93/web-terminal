import UIKit
import WebKit
import ObjectiveC

/// A WKWebView without the keyboard's extra bars:
///  - the input accessory bar (‹ › ✓) above the on-screen keyboard, and
///  - on iPad with a hardware keyboard, the shortcuts bar at the bottom of the
///    screen (language, undo/redo, dictation), which iPadOS shows whenever the
///    focused view's inputAssistantItem has button groups.
/// Both belong to WKWebView's private content view, so give that one instance a
/// runtime subclass with no `inputAccessoryView`, and empty its assistant item.
/// Only this view is affected; nothing global is swizzled.
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
        clearAssistantBar(content)
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

    private func clearAssistantBar(_ view: UIView) {
        let item = view.inputAssistantItem
        item.leadingBarButtonGroups = []
        item.trailingBarButtonGroups = []
    }

    // WebKit can rebuild the groups when the field regains focus; clear them again.
    override func becomeFirstResponder() -> Bool {
        let ok = super.becomeFirstResponder()
        hideInputAccessory()
        return ok
    }
}
