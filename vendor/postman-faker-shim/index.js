/**
 * Satisfies `require("@faker-js/faker/locale/en")` when Postman loads dynamic
 * variables. Generators return a fixed token and are not used for Atlas
 * examples (`schemaFaker: false`). This module does not implement
 * `helpers.fake`.
 */
function fakerApi() {
  function token() {
    return "example";
  }
  return new Proxy(token, {
    apply() {
      return "example";
    },
    get(target, property) {
      if (property === "prototype" || typeof property === "symbol") {
        return undefined;
      }
      if (property === "name") return "fakerStub";
      if (property === "length") return 0;
      return fakerApi();
    },
  });
}

module.exports = fakerApi();
