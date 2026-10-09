import CoreGraphics
import Foundation

/// Parses the subset of SVG path data the logo uses: absolute M, L, H, V, C and Z.
public enum SVGPath {
    public enum Command: Equatable, Sendable {
        case move(CGPoint)
        case line(CGPoint)
        case curve(CGPoint, CGPoint, CGPoint)
        case close
    }

    public enum ParseError: Error, Equatable {
        case unsupported(Character)
        case missingNumbers(Character)
    }

    public static func parse(_ data: String) throws -> [Command] {
        var commands: [Command] = []
        var current = CGPoint.zero
        let scanner = Scanner(string: data)
        scanner.charactersToBeSkipped = CharacterSet(charactersIn: " ,\n\t")
        var command: Character?

        func numbers(_ count: Int, for c: Character) throws -> [CGFloat] {
            try (0..<count).map { _ in
                guard let value = scanner.scanDouble() else { throw ParseError.missingNumbers(c) }
                return CGFloat(value)
            }
        }

        while !scanner.isAtEnd {
            if let letter = scanner.scanCharacter(), letter.isLetter {
                command = letter
            } else {
                // Implicit repeat of the previous command: step back over the number
                scanner.currentIndex = data.index(before: scanner.currentIndex)
            }
            guard let c = command else { throw ParseError.missingNumbers(" ") }
            switch c {
            case "M":
                let n = try numbers(2, for: c)
                current = CGPoint(x: n[0], y: n[1])
                commands.append(.move(current))
                command = "L" // further pairs are lines
            case "L":
                let n = try numbers(2, for: c)
                current = CGPoint(x: n[0], y: n[1])
                commands.append(.line(current))
            case "H":
                current.x = try numbers(1, for: c)[0]
                commands.append(.line(current))
            case "V":
                current.y = try numbers(1, for: c)[0]
                commands.append(.line(current))
            case "C":
                let n = try numbers(6, for: c)
                current = CGPoint(x: n[4], y: n[5])
                commands.append(.curve(CGPoint(x: n[0], y: n[1]), CGPoint(x: n[2], y: n[3]), current))
            case "Z", "z":
                commands.append(.close)
            default:
                throw ParseError.unsupported(c)
            }
        }
        return commands
    }

    public static func cgPath(_ commands: [Command]) -> CGPath {
        let path = CGMutablePath()
        for command in commands {
            switch command {
            case .move(let p): path.move(to: p)
            case .line(let p): path.addLine(to: p)
            case .curve(let c1, let c2, let p): path.addCurve(to: p, control1: c1, control2: c2)
            case .close: path.closeSubpath()
            }
        }
        return path
    }
}
