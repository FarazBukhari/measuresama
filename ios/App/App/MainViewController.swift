// NOT BUILT OR TESTED: written without Xcode. Expect fixes on the first build on a Mac with Xcode.
//
// Registers the app-local ArMeasure plugin with the Capacitor bridge.

import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ArMeasurePlugin())
        // The web view shows its background until the page paints. capacitor.config.ts can only set
        // one colour, so use the app's ground for the phone's light/dark setting (it updates on a
        // switch by itself), and dark mode never flashes light.
        let ground = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0x0F / 255.0, green: 0x0F / 255.0, blue: 0x0F / 255.0, alpha: 1)
                : UIColor(red: 0xF4 / 255.0, green: 0xF4 / 255.0, blue: 0xF1 / 255.0, alpha: 1)
        }
        webView?.backgroundColor = ground
        webView?.scrollView.backgroundColor = ground
    }
}
