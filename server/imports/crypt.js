import crypto from "crypto";

// takes a string and a password string, returns an EJSON binary
export function crypt(data, password) {
  password = new Buffer(password, "utf8"); // encode string as utf8
  const encrypt = crypto.createCipher("aes256", password);
  const output1 = encrypt.update(data, "utf8", null);
  const output2 = encrypt.final(null);
  const r = EJSON.newBinary(output1.length + output2.length);
  output1.copy(r);
  output2.copy(r, output1.length);
  return r;
}

// takes an EJSON binary and a password string, returns a string.
export function decrypt(data, password) {
  password = new Buffer(password, "utf8"); // encode string as utf8
  decrypt = crypto.createDecipher("aes256", password);
  data = new Buffer(data); // convert EJSON binary to Buffer
  let output = decrypt.update(data, null, "utf8");
  output += decrypt.final("utf8");
  return output;
}
