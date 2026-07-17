import fs from 'fs';
import path from 'path';

const database = {
  // 2019
  "252794": { year: "2019", name: "2019_1.jpg", selected: true },
  "224788": { year: "2019", name: "2019_2.jpg", selected: false },
  "243940": { year: "2019", name: "2019_3.jpg", selected: true },
  "238591": { year: "2019", name: "2019_4.jpg", selected: true },
  "219406": { year: "2019", name: "2019_5.jpg", selected: false },
  "240210": { year: "2019", name: "2019_6.jpg", selected: false },
  "214888": { year: "2019", name: "2019_7.jpg", selected: true },
  "266602": { year: "2019", name: "2019_8.jpg", selected: true },
  "196111": { year: "2019", name: "2019_9.jpg", selected: false },
  "214461": { year: "2019", name: "2019_10.jpg", selected: true },
  "320967": { year: "2019", name: "2019_11.jpg", selected: true },
  "247028": { year: "2019", name: "2019_12.jpg", selected: true },
  "219246": { year: "2019", name: "2019_13.jpg", selected: false },
  "223824": { year: "2019", name: "2019_14.jpg", selected: true },
  "249894": { year: "2019", name: "2019_15.jpg", selected: true },
  "175665": { year: "2019", name: "2019_16.jpg", selected: true },
  "237907": { year: "2019", name: "2019_17.jpg", selected: true },
  "138292": { year: "2019", name: "2019_18.jpg", selected: false },
  "172206": { year: "2019", name: "2019_19.jpg", selected: false },
  "268575": { year: "2019", name: "2019_20.jpg", selected: false },

  // 2020
  "286064": { year: "2020", name: "2020_1.jpg", selected: false },
  "267930": { year: "2020", name: "2020_2.jpg", selected: false },
  "227769": { year: "2020", name: "2020_3.jpg", selected: true },
  "155490": { year: "2020", name: "2020_4.jpg", selected: false },
  "108609": { year: "2020", name: "2020_5.jpg", selected: false },
  "198974": { year: "2020", name: "2020_6.jpg", selected: true },
  "203209": { year: "2020", name: "2020_7.jpg", selected: false },
  "208735": { year: "2020", name: "2020_8.jpg", selected: false },
  "228242": { year: "2020", name: "2020_9.jpg", selected: false },
  "183359": { year: "2020", name: "2020_10.jpg", selected: false },
  "83626":  { year: "2020", name: "2020_11.jpg", selected: false },
  "142064": { year: "2020", name: "2020_12.jpg", selected: true },
  "164800": { year: "2020", name: "2020_13.jpg", selected: false },
  "198578": { year: "2020", name: "2020_14.jpg", selected: false },
  "176136": { year: "2020", name: "2020_15.jpg", selected: false },
  "232880": { year: "2020", name: "2020_16.jpg", selected: false },
  "185021": { year: "2020", name: "2020_17.jpg", selected: false },
  "159326": { year: "2020", name: "2020_18.jpg", selected: false },
  "106756": { year: "2020", name: "2020_19.jpg", selected: false },
  "134006": { year: "2020", name: "2020_20.jpg", selected: true },
  "205941": { year: "2020", name: "2020_21.jpg", selected: true },
  "277511": { year: "2020", name: "2020_22.jpg", selected: true },
  "96106":  { year: "2020", name: "2020_23.jpg", selected: false },
  "182224": { year: "2020", name: "2020_24.jpg", selected: false },
  "235573": { year: "2020", name: "2020_25.jpg", selected: true },
  "203279": { year: "2020", name: "2020_26.jpg", selected: true },
  "316391": { year: "2020", name: "2020_27.jpg", selected: false },
  "235888": { year: "2020", name: "2020_28.jpg", selected: true },

  // 2021
  "209127": { year: "2021", name: "2021_1.jpg", selected: true },
  "107485": { year: "2021", name: "2021_2.jpg", selected: true },
  "198753": { year: "2021", name: "2021_3.jpg", selected: false },
  "176371": { year: "2021", name: "2021_4.jpg", selected: false },
  "122918": { year: "2021", name: "2021_5.jpg", selected: false },
  "99803":  { year: "2021", name: "2021_6.jpg", selected: true },
  "139833": { year: "2021", name: "2021_7.jpg", selected: true },
  "168848": { year: "2021", name: "2021_8.jpg", selected: false },
  "110829": { year: "2021", name: "2021_9.jpg", selected: true },
  "136446": { year: "2021", name: "2021_10.jpg", selected: false },
  "86491":  { year: "2021", name: "2021_11.jpg", selected: true },
  "133650": { year: "2021", name: "2021_12.jpg", selected: true },
  "112340": { year: "2021", name: "2021_13.jpg", selected: false },
  "160486": { year: "2021", name: "2021_14.jpg", selected: true },
  "181476": { year: "2021", name: "2021_15.jpg", selected: true },

  // 2022
  "59970":  { year: "2022", name: "2022_1.jpg", selected: false },
  "48582":  { year: "2022", name: "2022_2.jpg", selected: false },
  "114969": { year: "2022", name: "2022_3.jpg", selected: true },
  "136391": { year: "2022", name: "2022_4.jpg", selected: true },
  "126364": { year: "2022", name: "2022_5.jpg", selected: true },
  "139024": { year: "2022", name: "2022_6.jpg", selected: true },
  "72420":  { year: "2022", name: "2022_7.jpg", selected: true },
  "205525": { year: "2022", name: "2022_8.jpg", selected: true },
  "117812": { year: "2022", name: "2022_9.jpg", selected: true },
  "115625": { year: "2022", name: "2022_10.jpg", selected: true },
  "92492":  { year: "2022", name: "2022_11.jpg", selected: true },
  "103474": { year: "2022", name: "2022_12.jpg", selected: true },
  "158161": { year: "2022", name: "2022_13.jpg", selected: true },
  "216398": { year: "2022", name: "2022_14.jpg", selected: true },
  "202621": { year: "2022", name: "2022_15.jpg", selected: true },
  "155023": { year: "2022", name: "2022_16.jpg", selected: true },

  // 2023
  "124614": { year: "2023", name: "2023_1.jpg", selected: true },
  "156696": { year: "2023", name: "2023_2.jpg", selected: true },
  "133318": { year: "2023", name: "2023_3.jpg", selected: true },
  "84850":  { year: "2023", name: "2023_4.jpg", selected: true },
  "70179":  { year: "2023", name: "2023_5.jpg", selected: true },
  "104663": { year: "2023", name: "2023_6.jpg", selected: true },
  "199025": { year: "2023", name: "2023_7.jpg", selected: false },
  "45818":  { year: "2023", name: "2023_8.jpg", selected: true },
  "71997":  { year: "2023", name: "2023_9.jpg", selected: true },
  "117163": { year: "2023", name: "2023_10.jpg", selected: false },

  // 2024
  "97314":  { year: "2024", name: "2024_1.jpg", selected: false },
  "238741": { year: "2024", name: "2024_2.jpg", selected: true },
  "190059": { year: "2024", name: "2024_3.jpg", selected: true },
  "148051": { year: "2024", name: "2024_4.jpg", selected: false },
  "93039":  { year: "2024", name: "2024_5.jpg", selected: false },
  "85595":  { year: "2024", name: "2024_6.jpg", selected: true },
  "57335":  { year: "2024", name: "2024_7.jpg", selected: false },
  "138678": { year: "2024", name: "2024_8.jpg", selected: false },
  "133711": { year: "2024", name: "2024_9.jpg", selected: false },
  "59567":  { year: "2024", name: "2024_10.jpg", selected: false },
  "157702": { year: "2024", name: "2024_11.jpg", selected: true },
  "100561": { year: "2024", name: "2024_12.jpg", selected: false },
  "50176":  { year: "2024", name: "2024_13.jpg", selected: true },
  "98176":  { year: "2024", name: "2024_14.jpg", selected: true },
  "100127": { year: "2024", name: "2024_15.jpg", selected: false },
  "108290": { year: "2024", name: "2024_16.jpg", selected: true },
  "99460":  { year: "2024", name: "2024_17.jpg", selected: true },
  "213930": { year: "2024", name: "2024_18.jpg", selected: false },
  "239592": { year: "2024", name: "2024_19.jpg", selected: false },
  "248570": { year: "2024", name: "2024_20.jpg", selected: false },
  "109271": { year: "2024", name: "2024_21.jpg", selected: false },
  "224075": { year: "2024", name: "2024_22.jpg", selected: true },
  "171909": { year: "2024", name: "2024_23.jpg", selected: false },
  "229337": { year: "2024", name: "2024_24.jpg", selected: false },
  "228132": { year: "2024", name: "2024_25.jpg", selected: false },
  "264380": { year: "2024", name: "2024_26.jpg", selected: false },
  "81244":  { year: "2024", name: "2024_27.jpg", selected: true },
  "128680": { year: "2024", name: "2024_28.jpg", selected: true },
  "190983": { year: "2024", name: "2024_29.jpg", selected: false },
  "149375": { year: "2024", name: "2024_30.jpg", selected: true },
  "94137":  { year: "2024", name: "2024_31.jpg", selected: false },
  "110452": { year: "2024", name: "2024_32.jpg", selected: true },
  "150692": { year: "2024", name: "2024_33.jpg", selected: true },
  "131194": { year: "2024", name: "2024_34.jpg", selected: true },
  "156353": { year: "2024", name: "2024_35.jpg", selected: true },
  "53212":  { year: "2024", name: "2024_36.jpg", selected: false },
  "278399": { year: "2024", name: "2024_37.jpg", selected: true },
  "54126":  { year: "2024", name: "2024_38.jpg", selected: false },
  "107384": { year: "2024", name: "2024_39.jpg", selected: true },
  "131039": { year: "2024", name: "2024_41.jpg", selected: true },

  // 2025
  "174609": { year: "2025", name: "2025_1.jpg", selected: true },
  "160037": { year: "2025", name: "2025_2.jpg", selected: false },
  "93520":  { year: "2025", name: "2025_3.jpg", selected: false },
  "83392":  { year: "2025", name: "2025_4.jpg", selected: true },
  "86521":  { year: "2025", name: "2025_5.jpg", selected: true },
  "84599":  { year: "2025", name: "2025_6.jpg", selected: true },
  "48299":  { year: "2025", name: "2025_7.jpg", selected: true },
  "136799": { year: "2025", name: "2025_8.jpg", selected: true },
  "64766":  { year: "2025", name: "2025_9.jpg", selected: true },
  "80941":  { year: "2025", name: "2025_10.jpg", selected: true },
  "117241": { year: "2025", name: "2025_11.jpg", selected: true },
  "179552": { year: "2025", name: "2025_12.jpg", selected: true },
  "79945":  { year: "2025", name: "2025_13.jpg", selected: true },
  "85825":  { year: "2025", name: "2025_14.jpg", selected: true },
  "52915":  { year: "2025", name: "2025_17.jpg", selected: true },
  "171697": { year: "2025", name: "2025_18.jpg", selected: true },
  "88551":  { year: "2025", name: "2025_19.jpg", selected: true },
  "156484": { year: "2025", name: "2025_20.jpg", selected: false },
  "89300":  { year: "2025", name: "2025_21.jpg", selected: false },
  "77487":  { year: "2025", name: "2025_22.jpg", selected: false },
  "93762":  { year: "2025", name: "2025_23.jpg", selected: false },
  "87704":  { year: "2025", name: "2025_24.jpg", selected: false },
  "75890":  { year: "2025", name: "2025_25.jpg", selected: false },
  "74216":  { year: "2025", name: "2025_26.jpg", selected: false },
  "110798": { year: "2025", name: "2025_27.jpg", selected: false },
  "89104":  { year: "2025", name: "2025_28.jpg", selected: false },
  "59675":  { year: "2025", name: "2025_29.jpg", selected: true },
  "65170":  { year: "2025", name: "2025_30.jpg", selected: true },

  // 2026
  "90514":  { year: "2026", name: "2026_1.jpg", selected: true },
  "144610": { year: "2026", name: "2026_2.jpg", selected: true },
  "63173":  { year: "2026", name: "2026_3.jpg", selected: true },
  "106913": { year: "2026", name: "2026_4.jpg", selected: true },
  "150310": { year: "2026", name: "2026_5.jpg", selected: false },
  "85919":  { year: "2026", name: "2026_6.jpg", selected: true },
  "102775": { year: "2026", name: "2026_6_1.jpg", selected: false },
  "60706":  { year: "2026", name: "2026_6_2.jpg", selected: true },
  "76899":  { year: "2026", name: "2026_7.jpg", selected: true },
  "111899": { year: "2026", name: "2026_8.jpg", selected: true },
  "135302": { year: "2026", name: "2026_9.jpg", selected: true },

  // Общее
  "113580": { year: "Общее", name: "main_page.jpg", selected: false },
  "21990":  { year: "Общее", name: "photo_2024-10-03_22-48-51.jpg", selected: false },
  "23379":  { year: "Общее", name: "photo_2024-10-03_22-49-08.jpg", selected: false },
  "24006":  { year: "Общее", name: "photo_2024-10-03_22-49-16.jpg", selected: false },
  "112781": { year: "Общее", name: "photo_2026-03-21_13-36-50.jpg", selected: false },
  "163308": { year: "Общее", name: "photo_2026-05-11_17-51-32.jpg", selected: false }
};

const publicDir = './public';
const selectionDir = './public/ai_selection';

if (!fs.existsSync(selectionDir)) {
  fs.mkdirSync(selectionDir, { recursive: true });
}

const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.jpg'));
console.log(`Scanning ${files.length} files in public/...`);

let matchedCount = 0;
let restoredCount = 0;

for (const file of files) {
  const filePath = path.join(publicDir, file);
  const stats = fs.statSync(filePath);
  const size = stats.size.toString();

  if (database[size]) {
    const match = database[size];
    matchedCount++;

    // Create year directory inside public
    const yearDir = path.join(publicDir, match.year);
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    // Restore to original location
    const originalDest = path.join(yearDir, match.name);
    fs.copyFileSync(filePath, originalDest);
    restoredCount++;

    // If it's one of the curated selected images, copy to ai_selection folder too
    if (match.selected) {
      const selectionDest = path.join(selectionDir, match.name);
      fs.copyFileSync(filePath, selectionDest);
    }
  } else {
    console.log(`No database match for size ${size} (file: ${file})`);
  }
}

console.log(`Matched: ${matchedCount}/${files.length} files.`);
console.log(`Restored to folders: ${restoredCount}`);
