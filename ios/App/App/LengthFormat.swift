// NOT BUILT OR TESTED: written without Xcode. Expect fixes on the first build on a Mac with Xcode.
//
// Length labels shown on the AR screen. Must agree with the web formatLength:
// metric: < 1 m -> "X.X cm", else "X.XX m".
// imperial: round total inches to 0.1 first; < 12 -> "X.X in", else "F ft R.R in".
// Foundation-only so it parses and runs standalone.

import Foundation

enum LengthFormat {
    static let metresPerInch = 0.0254

    /// `unit` is "cm" (metric) or "in" (imperial). Anything else falls back to metric.
    static func label(metres: Double, unit: String) -> String {
        let m = metres.isFinite ? max(0, metres) : 0
        if unit == "in" {
            let totalInches = roundToTenth(m / metresPerInch)
            if totalInches < 12 {
                return String(format: "%.1f in", totalInches)
            }
            let feet = (totalInches / 12).rounded(.down)
            let rest = roundToTenth(totalInches - feet * 12)
            return String(format: "%d ft %.1f in", Int(feet), rest)
        }
        if m < 1 {
            return String(format: "%.1f cm", roundToTenth(m * 100))
        }
        return String(format: "%.2f m", (m * 100).rounded() / 100)
    }

    /// Half away from zero (same as JS Math.round for positive values), so printf never sees a tie.
    private static func roundToTenth(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }
}
