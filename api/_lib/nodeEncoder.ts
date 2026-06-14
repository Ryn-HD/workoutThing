import { gunzipSync, strFromU8 } from "fflate";

// Mirror of src/utils/encoder.ts Encoder_encode, which produces:
//   base64( "data:application/octet-stream;base64," + base64(gzip(utf8(str))) )
// (the browser path goes through FileReader.readAsDataURL then btoa of the whole data URL)
export function NodeEncoder_decode(encoded: string): string {
  const dataUrl = Buffer.from(encoded, "base64").toString("latin1");
  const commaIndex = dataUrl.indexOf(",");
  const innerB64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const gzipped = new Uint8Array(Buffer.from(innerB64, "base64"));
  return strFromU8(gunzipSync(gzipped));
}
