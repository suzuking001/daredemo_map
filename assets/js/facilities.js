(() => {
  window.App = window.App || {};
  const { indexOrThrow, normalizeNo, isAvailableMark } = window.App.utils || {};
  const { WEEKDAYS } = window.App.config || {};

  const TYPE_KEY_MAP = {
    "認定こども園": "certified",
    "私立認可保育園": "private",
    "公立認可保育園": "municipal",
    "小規模保育事業": "small",
    "事業所内保育事業": "onsite",
    "私立幼稚園": "kindergarten",
  };

  const DEFAULT_WEEKDAYS = ["月", "火", "水", "木", "金", "土"];

  function parseAgeList(raw) {
    const text = String(raw || "");
    const ages = new Set();
    const regex = /(\d+)歳/g;
    let match = null;
    while ((match = regex.exec(text))) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        ages.add(value);
      }
    }
    return Array.from(ages).sort((a, b) => a - b);
  }

  function buildSlots(headers, row, weekdays) {
    const slots = [];
    const days = (weekdays && weekdays.length ? weekdays : DEFAULT_WEEKDAYS).slice();
    for (let i = 1; i <= 5; i++) {
      const labelIndex = headers.indexOf(`受入枠${i}`);
      if (labelIndex < 0) {
        continue;
      }
      const label = row[labelIndex] || "";
      const dayValues = {};
      let hasAny = Boolean(label);
      days.forEach(day => {
        const dayIndex = headers.indexOf(`受入枠${i}_${day}`);
        const value = dayIndex >= 0 ? row[dayIndex] || "" : "";
        dayValues[day] = value;
        if (value) {
          hasAny = true;
        }
      });
      if (hasAny) {
        slots.push({ label, days: dayValues });
      }
    }
    return slots;
  }

  function buildWeekdayMaps(slots, weekdays) {
    const days = weekdays && weekdays.length ? weekdays : DEFAULT_WEEKDAYS;
    const availability = {};
    const slotLabelsByWeekday = {};
    days.forEach(day => {
      availability[day] = false;
      slotLabelsByWeekday[day] = [];
    });
    slots.forEach(slot => {
      days.forEach(day => {
        if (isAvailableMark(slot.days[day])) {
          availability[day] = true;
          if (slot.label) {
            slotLabelsByWeekday[day].push(slot.label);
          }
        }
      });
    });
    return { availability, slotLabelsByWeekday };
  }

  function addFacilitiesFromDataset(dataset) {
    const facHeaders = dataset.headers;
    const facRows = dataset.rows;

    const facNoIndex = indexOrThrow(facHeaders, "NO");
    const facNameIndex = indexOrThrow(facHeaders, "名称");
    const facLatIndex = indexOrThrow(facHeaders, "緯度");
    const facLonIndex = indexOrThrow(facHeaders, "経度");
    const facTypeIndex = indexOrThrow(facHeaders, "施設種類");
    const facAddr1Index = facHeaders.indexOf("所在地1");
    const facAddr2Index = facHeaders.indexOf("所在地2");
    const facPhoneIndex = facHeaders.indexOf("電話番号");
    const facAgeIndex = facHeaders.indexOf("利用できる歳児");
    const facWardIndex = facHeaders.indexOf("区");
    const facDistrictIndex = facHeaders.indexOf("地区");
    const facKanaIndex = facHeaders.indexOf("名称_カナ");
    const facMessageIndex = facHeaders.indexOf("施設からのメッセージ");
    const facNotesIndex = facHeaders.indexOf("備考");

    const facilities = [];
    const seen = {};

    facRows.forEach(row => {
      const noRaw = row[facNoIndex];
      const noKey = normalizeNo(noRaw);
      if (!noKey || seen[noKey]) {
        return;
      }

      const lat = parseFloat(row[facLatIndex]);
      const lon = parseFloat(row[facLonIndex]);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return;
      }

      const addr1 = facAddr1Index >= 0 ? row[facAddr1Index] : "";
      const addr2 = facAddr2Index >= 0 ? row[facAddr2Index] : "";
      const address = [addr1, addr2].filter(Boolean).join(" ");

      const type = facTypeIndex >= 0 ? row[facTypeIndex] || "" : "";
      const typeKey = TYPE_KEY_MAP[type] || "other";

      const agesRaw = facAgeIndex >= 0 ? row[facAgeIndex] : "";
      const ages = parseAgeList(agesRaw);

      const slots = buildSlots(facHeaders, row, WEEKDAYS);
      const { availability, slotLabelsByWeekday } = buildWeekdayMaps(slots, WEEKDAYS);

      facilities.push({
        no: noKey,
        noRaw,
        name: row[facNameIndex],
        nameKana: facKanaIndex >= 0 ? row[facKanaIndex] : "",
        lat,
        lon,
        address,
        phone: facPhoneIndex >= 0 ? row[facPhoneIndex] : "",
        ward: facWardIndex >= 0 ? row[facWardIndex] : "",
        district: facDistrictIndex >= 0 ? row[facDistrictIndex] : "",
        type,
        typeKey,
        agesRaw,
        ages,
        slots,
        weekdayAvailability: availability,
        slotLabelsByWeekday,
        message: facMessageIndex >= 0 ? row[facMessageIndex] : "",
        notes: facNotesIndex >= 0 ? row[facNotesIndex] : "",
      });
      seen[noKey] = true;
    });

    return facilities;
  }

  window.App.facilities = { addFacilitiesFromDataset };
})();
