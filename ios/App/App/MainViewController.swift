// NOT BUILT OR TESTED: written without Xcode. Expect fixes on the first build on a Mac with Xcode.
//
// Registers the app-local ArMeasure plugin with the Capacitor bridge.

import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ArMeasurePlugin())
    }
}
