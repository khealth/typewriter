/**
 * This client was automatically generated by Segment Typewriter. ** Do Not Edit **
 */

import Foundation

class OptionalObjectWithProperties1: TypewriterSerializable {
/// Optional any property
    var optionalAny: Any?
/// Optional array property
    var optionalArray: [Any]?
/// Optional boolean property
    var optionalBoolean: Bool?
/// Optional integer property
    var optionalInt: Int?
/// Optional number property
    var optionalNumber: Decimal?
/// Optional object property
    var optionalObject: [String: Any]?
/// Optional string property
    var optionalString: String?
/// Optional string property with a regex conditional
    var optionalStringWithRegex: String?

    init(optionalAny: Any?, optionalArray: [Any]?, optionalBoolean: Bool?, optionalInt: Int?, optionalNumber: Decimal?, optionalObject: [String: Any]?, optionalString: String?, optionalStringWithRegex: String?) {
        self.optionalAny = optionalAny
        self.optionalArray = optionalArray
        self.optionalBoolean = optionalBoolean
        self.optionalInt = optionalInt
        self.optionalNumber = optionalNumber
        self.optionalObject = optionalObject
        self.optionalString = optionalString
        self.optionalStringWithRegex = optionalStringWithRegex
    }

    func serializableDictionary() -> [String: Any] {
        var properties = [String: Any]()
        properties["optional any"] = self.optionalAny;
        properties["optional array"] = self.optionalArray?.serializableArray();
        properties["optional boolean"] = self.optionalBoolean;
        properties["optional int"] = self.optionalInt;
        properties["optional number"] = self.optionalNumber;
        properties["optional object"] = self.optionalObject;
        properties["optional string"] = self.optionalString;
        properties["optional string with regex"] = self.optionalStringWithRegex;

        return properties;
    }
}