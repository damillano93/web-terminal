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
    /// Edit → Copy (⌘C): the terminal's selection lives in a canvas, not the DOM,
    /// so WebKit would copy nothing. Returns true when the app copied it.
    var onCopy: (() -> Bool)?
    /// Control+letter with the terminal focused. On the Mac (Catalyst) WebKit does
    /// not reliably deliver these to the page, so Ctrl+C never interrupted
    /// anything; the app sends the control byte itself. Returns true if taken.
    var onControlKey: ((Character) -> Bool)?
    fileprivate var swallowedKeys = Set<Int>()

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
        startScrollFixTimer()
    }

    // WebKit turns each scrollable element (the terminal's scrollback) into a
    // native UIScrollView. On the Mac, and on an iPad with a mouse, those pan
    // when the mouse is *dragged*, so selecting text in Claude Code also
    // scrolled it. Let them pan only with a finger; the wheel and trackpad
    // still scroll (that is a separate scroll-event path). WebKit creates these
    // views as content changes, so re-apply periodically.
    private var scrollFixTimer: Timer?
    private func startScrollFixTimer() {
        guard window != nil else { scrollFixTimer?.invalidate(); scrollFixTimer = nil; return }
        restrictPanToTouch()
        guard scrollFixTimer == nil else { return }
        scrollFixTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.restrictPanToTouch()
        }
    }

    private func restrictPanToTouch() {
        let direct = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        func walk(_ v: UIView) {
            if let sv = v as? UIScrollView, sv.panGestureRecognizer.allowedTouchTypes != direct {
                sv.panGestureRecognizer.allowedTouchTypes = direct
            }
            v.subviews.forEach(walk)
        }
        walk(scrollView)
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

            let copySel = #selector(UIResponderStandardEditActions.copy(_:))
            if let original = class_getMethodImplementation(base, copySel) {
                typealias CopyFn = @convention(c) (AnyObject, Selector, AnyObject?) -> Void
                let callOriginal = unsafeBitCast(original, to: CopyFn.self)
                let copy: @convention(block) (AnyObject, AnyObject?) -> Void = { view, sender in
                    if let web = (view as? UIView)?.enclosingWebView, let handler = web.onCopy, handler() { return }
                    callOriginal(view, copySel, sender)
                }
                class_addMethod(made, copySel, imp_implementationWithBlock(copy),
                                method_getTypeEncoding(class_getInstanceMethod(base, copySel)!))
            }

            // pressesBegan/Ended: route Control+letter to onControlKey, swallow the
            // matching key-up, and pass everything else to WebKit.
            typealias PressFn = @convention(c) (AnyObject, Selector, AnyObject, AnyObject?) -> Void
            let beganSel = #selector(UIResponder.pressesBegan(_:with:))
            let endedSel = #selector(UIResponder.pressesEnded(_:with:))
            if let ob = class_getMethodImplementation(base, beganSel), let oe = class_getMethodImplementation(base, endedSel) {
                let origBegan = unsafeBitCast(ob, to: PressFn.self)
                let origEnded = unsafeBitCast(oe, to: PressFn.self)
                let began: @convention(block) (AnyObject, AnyObject, AnyObject?) -> Void = { view, presses, event in
                    if let web = (view as? UIView)?.enclosingWebView, let handler = web.onControlKey,
                       let set = presses as? Set<UIPress>, set.count == 1, let key = set.first?.key,
                       key.modifierFlags.intersection([.control, .command, .alternate, .shift]) == .control,
                       let ch = key.charactersIgnoringModifiers.lowercased().first, handler(ch) {
                        web.swallowedKeys.insert(key.keyCode.rawValue)
                        return
                    }
                    origBegan(view, beganSel, presses, event)
                }
                let ended: @convention(block) (AnyObject, AnyObject, AnyObject?) -> Void = { view, presses, event in
                    if let web = (view as? UIView)?.enclosingWebView, let set = presses as? Set<UIPress>,
                       let code = set.first?.key?.keyCode.rawValue, web.swallowedKeys.remove(code) != nil {
                        return
                    }
                    origEnded(view, endedSel, presses, event)
                }
                class_addMethod(made, beganSel, imp_implementationWithBlock(began),
                                method_getTypeEncoding(class_getInstanceMethod(base, beganSel)!))
                class_addMethod(made, endedSel, imp_implementationWithBlock(ended),
                                method_getTypeEncoding(class_getInstanceMethod(base, endedSel)!))
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
