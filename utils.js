function countNodes(data, count = 0) {
  if (data === null || data === undefined) {
    return count;
  }

  if (typeof data === "object") {
    count++; // Count this object
    for (const key in data) {
      count = countNodes(data[key], count);
    }
  } else {
    count++; // Count primitive values
  }

  return count;
}

// Helper function to determine value type
function determineValueType(value) {
  if (typeof value === "boolean") {
    return "BOOLEAN";
  } else if (typeof value === "number") {
    return "NUMBER";
  } else if (typeof value === "object" && value !== null) {
    return "JSON";
  } else {
    return "STRING";
  }
}

module.exports = {
  countNodes,
  determineValueType,
};
