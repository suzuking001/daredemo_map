(() => {
  window.App = window.App || {};
  const { indexOrThrow, normalizeNo } = window.App.utils || {};
  const { WEEKDAYS, FACILITY_SOURCES } = window.App.config || {};

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
        if ((window.App.utils || {}).isAvailableMark(slot.days[day])) {
          availability[day] = true;
          if (slot.label) {
            slotLabelsByWeekday[day].push(slot.label);
          }
        }
      });
    });
    return { availability, slotLabelsByWeekday };
  }

  function addBaseFacilitiesFromDataset(facilityMap, dataset, source) {
    if (!dataset || !dataset.headers || !dataset.rows) {
      return;
    }
    const facHeaders = dataset.headers;
    const facRows = dataset.rows;

    const facNoIndex = indexOrThrow(facHeaders, "NO");
    const facNameIndex = indexOrThrow(facHeaders, "名称");
    const facLatIndex = indexOrThrow(facHeaders, "緯度");
    const facLonIndex = indexOrThrow(facHeaders, "経度");
    const facAddr1Index = facHeaders.indexOf("所在地1");
    const facAddr2Index = facHeaders.indexOf("所在地2");
    const facPhoneIndex = facHeaders.indexOf("電話番号");
    const facWardIndex = facHeaders.indexOf("区");
    const facDistrictIndex = facHeaders.indexOf("地区");
    const facKanaIndex = facHeaders.indexOf("名称_カナ");

    const typeKey = source && source.key ? source.key : "other";
    const typeLabel = source && source.label ? source.label : "";

    facRows.forEach(row => {
      const noRaw = row[facNoIndex];
      const noKey = normalizeNo(noRaw);
      if (!noKey || facilityMap[noKey]) {
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

      facilityMap[noKey] = {
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
        type: typeLabel,
        typeKey,
        agesRaw: "",
        ages: [],
        slots: [],
        weekdayAvailability: {},
        slotLabelsByWeekday: {},
        message: "",
        notes: "",
        hasAvailability: false,
      };
    });
  }

  function mergeAvailabilityDataset(facilityMap, dataset) {
    if (!dataset || !dataset.headers || !dataset.rows) {
      return;
    }
    const facHeaders = dataset.headers;
    const facRows = dataset.rows;

    const facNoIndex = indexOrThrow(facHeaders, "NO");
    const facNameIndex = indexOrThrow(facHeaders, "名称");
    const facLatIndex = indexOrThrow(facHeaders, "緯度");
    const facLonIndex = indexOrThrow(facHeaders, "経度");
    const facTypeIndex = facHeaders.indexOf("施設種類");
    const facAddr1Index = facHeaders.indexOf("所在地1");
    const facAddr2Index = facHeaders.indexOf("所在地2");
    const facPhoneIndex = facHeaders.indexOf("電話番号");
    const facAgeIndex = facHeaders.indexOf("利用できる歳児");
    const facWardIndex = facHeaders.indexOf("区");
    const facDistrictIndex = facHeaders.indexOf("地区");
    const facKanaIndex = facHeaders.indexOf("名称_カナ");
    const facMessageIndex = facHeaders.indexOf("施設からのメッセージ");
    const facNotesIndex = facHeaders.indexOf("備考");

    facRows.forEach(row => {
      const noRaw = row[facNoIndex];
      const noKey = normalizeNo(noRaw);
      if (!noKey) {
        return;
      }

      const lat = parseFloat(row[facLatIndex]);
      const lon = parseFloat(row[facLonIndex]);
      const hasLatLon = Number.isFinite(lat) && Number.isFinite(lon);

      let facility = facilityMap[noKey];
      if (!facility) {
        if (!hasLatLon) {
          return;
        }
        facility = {
          no: noKey,
          noRaw,
          name: row[facNameIndex],
          nameKana: facKanaIndex >= 0 ? row[facKanaIndex] : "",
          lat,
          lon,
          address: "",
          phone: "",
          ward: "",
          district: "",
          type: "",
          typeKey: "other",
          agesRaw: "",
          ages: [],
          slots: [],
          weekdayAvailability: {},
          slotLabelsByWeekday: {},
          message: "",
          notes: "",
          hasAvailability: false,
        };
        facilityMap[noKey] = facility;
      }

      if (!facility.noRaw) {
        facility.noRaw = noRaw;
      }
      if (!facility.name && row[facNameIndex]) {
        facility.name = row[facNameIndex];
      }
      if (!facility.nameKana && facKanaIndex >= 0) {
        facility.nameKana = row[facKanaIndex] || "";
      }
      if (hasLatLon) {
        facility.lat = lat;
        facility.lon = lon;
      }

      const addr1 = facAddr1Index >= 0 ? row[facAddr1Index] : "";
      const addr2 = facAddr2Index >= 0 ? row[facAddr2Index] : "";
      const address = [addr1, addr2].filter(Boolean).join(" ");
      if (!facility.address && address) {
        facility.address = address;
      }
      const phone = facPhoneIndex >= 0 ? row[facPhoneIndex] : "";
      if (!facility.phone && phone) {
        facility.phone = phone;
      }
      const ward = facWardIndex >= 0 ? row[facWardIndex] : "";
      if (!facility.ward && ward) {
        facility.ward = ward;
      }
      const district = facDistrictIndex >= 0 ? row[facDistrictIndex] : "";
      if (!facility.district && district) {
        facility.district = district;
      }

      const type = facTypeIndex >= 0 ? row[facTypeIndex] || "" : "";
      if (type) {
        facility.type = type;
        facility.typeKey = TYPE_KEY_MAP[type] || facility.typeKey || "other";
      }

      const agesRaw = facAgeIndex >= 0 ? row[facAgeIndex] : "";
      facility.agesRaw = agesRaw;
      facility.ages = parseAgeList(agesRaw);

      const slots = buildSlots(facHeaders, row, WEEKDAYS);
      const { availability, slotLabelsByWeekday } = buildWeekdayMaps(slots, WEEKDAYS);
      facility.slots = slots;
      facility.weekdayAvailability = availability;
      facility.slotLabelsByWeekday = slotLabelsByWeekday;
      facility.message = facMessageIndex >= 0 ? row[facMessageIndex] : "";
      facility.notes = facNotesIndex >= 0 ? row[facNotesIndex] : "";
      facility.hasAvailability = true;
    });
  }

  function addFacilitiesFromDatasets(facilityDatasets, availabilityDataset, sources) {
    const facilityMap = {};
    const sourceList = Array.isArray(sources) && sources.length
      ? sources
      : Array.isArray(FACILITY_SOURCES)
        ? FACILITY_SOURCES
        : [];

    (facilityDatasets || []).forEach((dataset, index) => {
      addBaseFacilitiesFromDataset(facilityMap, dataset, sourceList[index]);
    });
    mergeAvailabilityDataset(facilityMap, availabilityDataset);

    return Object.values(facilityMap);
  }

  window.App.facilities = { addFacilitiesFromDatasets };
})();
