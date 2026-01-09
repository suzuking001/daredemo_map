(() => {
  window.App = window.App || {};
  const { escapeHtml } = window.App.utils || {};
  const { WEEKDAYS } = window.App.config || {};
  const { matchesAge, getWeekdaySlotLabels } = window.App.mapUtils || {};

  const DEFAULT_WEEKDAYS = ["月", "火", "水", "木", "金", "土"];

  function buildScheduleTable(slots, weekdays) {
    if (!slots.length) {
      return '<div class="empty">受入枠の情報がありません。</div>';
    }

    const days = weekdays && weekdays.length ? weekdays : DEFAULT_WEEKDAYS;
    const headerCells = [
      "<th>時間帯</th>",
      ...days.map(day => `<th>${escapeHtml(day)}</th>`),
    ].join("");

    const bodyRows = slots
      .map(slot => {
        const dayCells = days
          .map(day => `<td>${escapeHtml(slot.days[day] || "-")}</td>`)
          .join("");
        return `
      <tr>
        <td>${escapeHtml(slot.label || "-")}</td>
        ${dayCells}
      </tr>
    `;
      })
      .join("");

    return `
    <div class="availability-wrap">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
  }

  function buildTooltipHtml(facility, selectedWeekday, selectedAge) {
    const name = escapeHtml(facility.name || "名称不明");
    if (!selectedWeekday && !selectedAge) {
      return name;
    }
    if (facility.hasAvailability === false) {
      return `
        <div class="label-title">${name}</div>
        <div class="label-status"><span class="label-empty">情報なし</span></div>
      `;
    }

    const ageMatch = matchesAge ? matchesAge(facility, selectedAge) : true;
    let statusHtml = "";

    if (selectedAge && !ageMatch) {
      statusHtml = '<span class="label-empty">対象年齢外</span>';
    } else if (selectedWeekday) {
      const slots = getWeekdaySlotLabels
        ? getWeekdaySlotLabels(facility, selectedWeekday)
        : [];
      if (slots.length) {
        statusHtml = `<span>${escapeHtml(selectedWeekday)}: ${escapeHtml(slots.join(" / "))}</span>`;
      } else {
        statusHtml = '<span class="label-empty">該当曜日なし</span>';
      }
    } else if (selectedAge) {
      statusHtml = "<span>対象年齢</span>";
    }

    return `
      <div class="label-title">${name}</div>
      <div class="label-status">${statusHtml}</div>
    `;
  }

  function buildPopupHtml(facility, selectedWeekday, selectedAge) {
    const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(
      `${facility.lat},${facility.lon}`
    )}`;
    const searchQuery = facility.name
      ? `浜松市 ${facility.name}`
      : "浜松市";
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    const phoneRaw = String(facility.phone || "").trim();
    const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
    const phoneLabel = phoneRaw ? `電話をかける: ${escapeHtml(phoneRaw)}` : "電話をかける";
    const phoneLink = phoneDigits
      ? `<a class="popup-link" href="tel:${escapeHtml(phoneDigits)}">${phoneLabel}</a>`
      : "";

    const ageLabel = selectedAge ? `${selectedAge}歳` : "全年齢";
    const weekdayLabel = selectedWeekday ? `${selectedWeekday}曜日` : "全曜日";
    const selectedMeta = (selectedWeekday || selectedAge)
      ? `<div class="meta">選択条件: ${escapeHtml(weekdayLabel)} / 年齢: ${escapeHtml(ageLabel)}</div>`
      : "";

    const slotsForDay = selectedWeekday && getWeekdaySlotLabels
      ? getWeekdaySlotLabels(facility, selectedWeekday)
      : [];
    const slotLine = selectedWeekday
      ? `<div class="meta">選択曜日の受入枠: ${slotsForDay.length ? escapeHtml(slotsForDay.join(" / ")) : "なし"}</div>`
      : "";

    const metaLines = [
      facility.type && `施設種別: ${escapeHtml(facility.type)}`,
      facility.ward && `区: ${escapeHtml(facility.ward)}`,
      facility.district && `地区: ${escapeHtml(facility.district)}`,
      facility.address && `所在地: ${escapeHtml(facility.address)}`,
      facility.phone && `電話番号: ${escapeHtml(facility.phone)}`,
      facility.agesRaw && `利用できる歳児: ${escapeHtml(facility.agesRaw)}`,
      facility.message && `施設からのメッセージ: ${escapeHtml(facility.message)}`,
      facility.notes && `備考: ${escapeHtml(facility.notes)}`,
    ]
      .filter(Boolean)
      .map(line => `<div class="meta">${line}</div>`)
      .join("");

    return `
        <div class="popup">
          <div class="title">${escapeHtml(facility.name || "名称不明")}</div>
          <div class="meta">施設No.: ${escapeHtml(facility.noRaw || facility.no)}</div>
          ${selectedMeta}
          ${slotLine}
          ${metaLines}
          <div class="section popup-actions">
            <a class="popup-link" href="${mapsUrl}" target="_blank" rel="noopener">Google Mapで開く</a>
            <a class="popup-link" href="${searchUrl}" target="_blank" rel="noopener">Googleで検索</a>
            ${phoneLink}
          </div>
          <div class="section">
            ${buildScheduleTable(facility.slots || [], WEEKDAYS)}
          </div>
        </div>
      `;
  }

  window.App.availability = {
    buildScheduleTable,
    buildTooltipHtml,
    buildPopupHtml,
  };
})();
