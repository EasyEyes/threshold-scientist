function transformGlossaryRows(rows) {
  return rows
    .filter((row) => !row.name.includes("__"))
    .map((row) => ({
      name: row.name,
      availability: row.availability,
      type: row.type,
      default: row.default,
      explanation: row.explanation,
      example: row.example,
      categories:
        row.type === "categorical" || row.type === "multicategorical"
          ? row.categories.split(",").map((s) => s.trim())
          : [],
    }));
}

module.exports = { transformGlossaryRows };
