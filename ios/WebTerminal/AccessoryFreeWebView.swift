import UIKit
import WebKit
import ObjectiveC

/// A WKWebView without the keyboard's extra bars:
///  - the input accessory bar (‹ › ✓) above the on-screen keyboard, and
///  - on iPad with a hardware keyboard, the shortcuts bar at the bottom of the
///    screen (language, undo/redo, dictation), which iPadOS shows whenever the
///    focused view's inputAssistantItem has button groups.
/// Both belong to WKWebView's private content view. That one instance gets a
/// runtime subclass with no `inputAccessoryView` and an `inputAssistantItem`
/// that refuses button groups — WebKit refills the groups every time an element
/// takes focus (entering zen mode did it), so emptying them once is not enough.
/// Nothing global is swizzled.
final class AccessoryFreeWebView: WKWebView {
    private static let subclassName = "WTNoAccessoryContentView"
    private static var assistantKey: UInt8 = 0

    /// Cmd+V / "Paste": the app gets the first look and returns true if it took
    /// the pasteboard as images to upload; otherwise WebKit pastes the text.
    var onPaste: (() -> Bool)?

    override init(frame: CGRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
        // Belt and braces: whatever the keyboard does, re-check on every show.
        for name in [UIResponder.keyboardWillShowNotification, UIResponder.keyboardDidChangeFrameNotification,
                     UITextInputMode.currentInputModeDidChangeNotification] {
            NotificationCenter.default.addObserver(self, selector: #selector(refresh), name: name, object: nil)
        }
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        refresh()
    }

    override func becomeFirstResponder() -> Bool {
        let ok = super.becomeFirstResponder()
        refresh()
        return ok
    }

    @objc private func refresh() {
        guard let content = scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else { return }
        install(on: content)
        content.inputAssistantItem.leadingBarButtonGroups = []
        content.inputAssistantItem.trailingBarButtonGroups = []
    }

    private func install(on content: UIView) {
        let base: AnyClass = type(of: content)
        if NSStringFromClass(base) == Self.subclassName { return }

        let subclass: AnyClass
        if let existing = NSClassFromString(Self.subclassName) {
            subclass = existing
        } else {
            guard let made = objc_allocateClassPair(base, Self.subclassName, 0) else { return }

            let accessorySel = #selector(getter: UIResponder.inputAccessoryView)
            let noAccessory: @convention(block) (AnyObject) -> AnyObject? = { _ in nil }
            class_addMethod(made, accessorySel, imp_implementationWithBlock(noAccessory),
                            method_getTypeEncoding(class_getInstanceMethod(UIView.self, accessorySel)!))

            let assistantSel = #selector(getter: UIResponder.inputAssistantItem)
            let emptyAssistant: @convention(block) (AnyObject) -> AnyObject = { view in
                if let item = objc_getAssociatedObject(view, &AccessoryFreeWebView.assistantKey) as? EmptyAssistantItem {
                    return item
                }
                let item = EmptyAssistantItem()
                objc_setAssociatedObject(view, &AccessoryFreeWebView.assistantKey, item, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
                return item
            }
            class_addMethod(made, assistantSel, imp_implementationWithBlock(emptyAssistant),
                            method_getTypeEncoding(class_getInstanceMethod(UIResponder.self, assistantSel)!))

            // paste: — an image-only pasteboard goes to onPasteImage; anything
            // else takes WebKit's normal path (the original implementation).
            let pasteSel = #selector(UIResponderStandardEditActions.paste(_:))
            if let original = class_getMethodImplementation(base, pasteSel) {
                typealias PasteFn = @convention(c) (AnyObject, Selector, AnyObject?) -> Void
                let callOriginal = unsafeBitCast(original, to: PasteFn.self)
                let paste: @convention(block) (AnyObject, AnyObject?) -> Void = { view, sender in
                    if let web = (view as? UIView)?.enclosingWebView, let handler = web.onPaste, handler() {
                        return
                    }
                    callOriginal(view, pasteSel, sender)
                }
                class_addMethod(made, pasteSel, imp_implementationWithBlock(paste),
                                method_getTypeEncoding(class_getInstanceMethod(base, pasteSel)!))
            }

            objc_registerClassPair(made)
            subclass = made
        }
        object_setClass(content, subclass)
    }
}

/// An assistant item that stays empty: setting groups is a no-op.
private final class EmptyAssistantItem: UITextInputAssistantItem {
    override var leadingBarButtonGroups: [UIBarButtonItemGroup] {
        get { [] }
        set { }
    }
    override var trailingBarButtonGroups: [UIBarButtonItemGroup] {
        get { [] }
        set { }
    }
}

private extension UIView {
    var enclosingWebView: AccessoryFreeWebView? {
        var v: UIView? = superview
        while let cur = v {
            if let web = cur as? AccessoryFreeWebView { return web }
            v = cur.superview
        }
        return nil
    }
}
