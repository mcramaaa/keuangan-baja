import { convertCustomDate, convertToNumber } from "@/helper/convert";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: "./key.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

async function readPiutang() {
  const spreadsheetId = "1frEsU9GKhi0CGJng_K0Wf5wZW-4GvMDWz2T8cCULVes";
  const rangeAtoZ = "PIUTANG!A3:AA";
  const rangeAD = "PIUTANG!AD3:AD";

  try {
    const resAtoZ = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeAtoZ,
    });
    const resAD = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeAD,
    });

    const dataAtoZ = resAtoZ.data.values || [];
    const dataAD = resAD.data.values || [];
    const data = dataAtoZ
      .filter((data) => data[2] !== "")
      .map((data, i) => ({
        id: i + 1,
        po: data[2],
        sub: data[3],
        poDate: convertCustomDate(data[4]),
        name: data[5],
        sj: data[7],
        sjDate: convertCustomDate(data[8]),
        inv: data[9],
        invDate: convertCustomDate(data[11]),
        rangeDay: +data[12],
        dueDate: convertCustomDate(data[13]),
        overDue: data[18],
        bill: convertToNumber(data[21]),
        payment: convertToNumber(data[23]),
        billRemaning:
          convertToNumber(data[21]) - convertToNumber(data[23]) <= 1
            ? 0
            : convertToNumber(data[21]) - convertToNumber(data[23]),
        status: data[26],
        billingStatus: dataAD[i]?.at(0),
      }));
    return data;
  } catch (err) {
    console.error("The API returned an error:", err);
    throw err;
  }
}

export default readPiutang;
