/**
 * This client was automatically generated by Segment Typewriter. ** Do Not Edit **
 */

import Foundation

class OccupantsItem: TypewriterSerializable {
/// The name of this occupant.
    var name: String

    init(name: String) {
        self.name = name
    }

    func serializableDictionary() -> [String: Any] {
        var properties = [String: Any]()
        properties["name"] = self.name;

        return properties;
    }
}