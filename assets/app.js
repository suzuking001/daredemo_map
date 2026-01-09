(() => {
  const {
    DATA_CSV_URL,
    TILE_URL,
    TILE_ATTRIBUTION,
    MARKER_STYLE_DEFAULT,
    MARKER_STYLE_FULL,
    MARKER_STYLE_AVAILABLE,
    WEEKDAYS,
  } = window.App.config;
  const { fetchCSV, parseCSV } = window.App.csv;
  const { buildTooltipHtml, buildPopupHtml } = window.App.availability;
  const {
    resolveMarkerStyle,
    getAvailabilityStatus,
    getPopupOptions,
    isMobileView,
    createRangeLabel,
  } = window.App.mapUtils;
  const { addFacilitiesFromDataset } = window.App.facilities;

  let menuToggle = null;
  let ageSelect = null;
  let weekdaySelect = null;
  const detailsModal = document.getElementById("details-modal");
  const detailsBody = document.getElementById("details-body");
  const detailsClose = document.getElementById("details-close");
  const aboutModal = document.getElementById("about-modal");
  const aboutClose = document.getElementById("about-close");
  const aboutButton = document.getElementById("about-button");
  let lastDetailsFocus = null;
  let lastAboutFocus = null;

  const WORKER_SOURCE = String.raw`
(() => {
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === "\"") {
          if (text[i + 1] === "\"") {
            field += "\"";
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === "\"") {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    const headers = rows.shift() || [];
    const cleanedRows = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
    return { headers, rows: cleanedRows };
  }

  self.onmessage = event => {
    const data = event.data || {};
    const id = data.id;
    const facilityTexts = data.facilityTexts;
    if (!id || !Array.isArray(facilityTexts)) {
      return;
    }
    try {
      const facilities = facilityTexts.map(parseCSV);
      self.postMessage({
        id,
        ok: true,
        payload: { facilities },
      });
    } catch (error) {
      self.postMessage({
        id,
        ok: false,
        error: error && error.message ? error.message : "Worker failed",
      });
    }
  };
})();
`;

  function parseInWorker(facilityTexts) {
    if (!("Worker" in window)) {
      return Promise.resolve(null);
    }
    if (!Array.isArray(facilityTexts)) {
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      let worker;
      let workerUrl = null;
      const createInlineWorker = () => {
        const blob = new Blob([WORKER_SOURCE], { type: "text/javascript" });
        workerUrl = URL.createObjectURL(blob);
        return new Worker(workerUrl);
      };
      try {
        if (window.location.protocol === "file:") {
          worker = createInlineWorker();
        } else {
          try {
            worker = new Worker("assets/js/csv-worker.js");
          } catch (error) {
            worker = createInlineWorker();
          }
        }
      } catch (error) {
        console.warn("Worker unavailable:", error);
        if (workerUrl) {
          URL.revokeObjectURL(workerUrl);
        }
        resolve(null);
        return;
      }

      const messageId = `csv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        worker.terminate();
        if (workerUrl) {
          URL.revokeObjectURL(workerUrl);
        }
      };
      const handleMessage = event => {
        const data = event.data;
        if (!data || data.id !== messageId) {
          return;
        }
        cleanup();
        if (data.ok && data.payload) {
          resolve(data.payload);
          return;
        }
        console.warn("Worker parse failed:", data && data.error);
        resolve(null);
      };
      const handleError = event => {
        cleanup();
        console.warn("Worker error:", event && event.message);
        resolve(null);
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage({
        id: messageId,
        facilityTexts,
      });
    });
  }

  const focusIfPossible = element => {
    if (!element || typeof element.focus !== "function") {
      return false;
    }
    if (!element.isConnected || element.getClientRects().length === 0) {
      return false;
    }
    element.focus();
    return document.activeElement === element;
  };

  function setDetailsOpen(isOpen, htmlContent = "") {
    if (!detailsModal || !detailsBody) {
      return;
    }
    if (isOpen) {
      lastDetailsFocus = document.activeElement;
      detailsBody.innerHTML = htmlContent;
      detailsModal.inert = false;
      detailsModal.setAttribute("aria-hidden", "false");
      if (detailsClose) {
        detailsClose.focus();
      }
      detailsModal.classList.toggle("open", true);
      return;
    }
    const activeElement = document.activeElement;
    if (detailsModal.contains(activeElement)) {
      const focused =
        focusIfPossible(lastDetailsFocus) || focusIfPossible(menuToggle);
      if (!focused && activeElement && activeElement.blur) {
        activeElement.blur();
      }
    }
    detailsModal.classList.toggle("open", false);
    detailsModal.setAttribute("aria-hidden", "true");
    detailsModal.inert = true;
  }

  function setAboutOpen(isOpen) {
    if (!aboutModal) {
      return;
    }
    if (isOpen) {
      lastAboutFocus = document.activeElement;
      setDetailsOpen(false);
      aboutModal.inert = false;
      aboutModal.setAttribute("aria-hidden", "false");
      if (aboutClose) {
        aboutClose.focus();
      }
      aboutModal.classList.toggle("open", true);
      return;
    }
    const activeElement = document.activeElement;
    if (aboutModal.contains(activeElement)) {
      const focused =
        focusIfPossible(lastAboutFocus) ||
        focusIfPossible(aboutButton) ||
        focusIfPossible(menuToggle);
      if (!focused && activeElement && activeElement.blur) {
        activeElement.blur();
      }
    }
    aboutModal.classList.toggle("open", false);
    aboutModal.setAttribute("aria-hidden", "true");
    aboutModal.inert = true;
  }

  function getSelectedFilters() {
    return {
      selectedAge: ageSelect ? ageSelect.value : "",
      selectedWeekday: weekdaySelect ? weekdaySelect.value : "",
    };
  }

  async function main() {
    const dataText = await fetchCSV(DATA_CSV_URL);
    const workerResult = await parseInWorker([dataText]);
    const dataset = workerResult && workerResult.facilities && workerResult.facilities[0]
      ? workerResult.facilities[0]
      : parseCSV(dataText);
    const facilities = addFacilitiesFromDataset(dataset);

    const map = L.map("map", { zoomControl: false, attributionControl: true })
      .setView([34.7108, 137.7266], 12);
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map);
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a> (MIT)'
    );
    map.attributionControl.setPosition("topright");
    const controlPosition = isMobileView() ? "topleft" : "bottomright";
    L.control.zoom({ position: controlPosition }).addTo(map);

    const locateControl = L.control({ position: controlPosition });
    locateControl.onAdd = () => {
      const container = L.DomUtil.create("div", "leaflet-control leaflet-control-locate");
      const button = L.DomUtil.create("button", "locate-button", container);
      button.type = "button";
      button.title = "現在地を表示";
      button.setAttribute("aria-label", "現在地を表示");
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4"></circle>
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
        </svg>
      `;

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, "click", event => {
        L.DomEvent.stop(event);
        map.locate({ setView: true, maxZoom: 16 });
      });
      return container;
    };
    locateControl.addTo(map);

    const markerRenderer = L.canvas({ padding: 0.5 });
    const markers = [];
    const updateLabelOpacity = () => {
      const zoom = map.getZoom();
      const minZoom = 12;
      const maxZoom = 14;
      let opacity = 1;
      if (zoom <= minZoom) {
        opacity = 0;
      } else if (zoom >= maxZoom) {
        opacity = 1;
      } else {
        opacity = (zoom - minZoom) / (maxZoom - minZoom);
      }
      markers.forEach(item => {
        const tooltip = item.marker.getTooltip();
        const el = tooltip ? tooltip.getElement() : null;
        if (!el) {
          return;
        }
        el.style.opacity = String(opacity);
        el.style.pointerEvents = opacity < 0.2 ? "none" : "auto";
      });
    };

    facilities.forEach(facility => {
      let labelClass = "marker-label";
      if (facility.typeKey === "private") {
        labelClass = "marker-label marker-label-private";
      } else if (facility.typeKey === "municipal") {
        labelClass = "marker-label marker-label-municipal";
      } else if (facility.typeKey === "small") {
        labelClass = "marker-label marker-label-small";
      } else if (facility.typeKey === "onsite") {
        labelClass = "marker-label marker-label-onsite";
      } else if (facility.typeKey === "kindergarten") {
        labelClass = "marker-label marker-label-kindergarten";
      }

      const openDetails = () => {
        const { selectedAge, selectedWeekday } = getSelectedFilters();
        if (isMobileView()) {
          setDetailsOpen(true, buildPopupHtml(facility, selectedWeekday, selectedAge));
          return;
        }
        if (marker.getPopup()) {
          marker.openPopup();
        }
      };

      const marker = L.circleMarker([facility.lat, facility.lon], {
        radius: 8,
        color: MARKER_STYLE_DEFAULT.color,
        fillColor: MARKER_STYLE_DEFAULT.fillColor,
        fillOpacity: 0.9,
        weight: 2,
        renderer: markerRenderer,
      })
        .addTo(map)
        .bindTooltip(buildTooltipHtml(facility, "", ""), {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: labelClass,
          interactive: true,
        });

      if (isMobileView()) {
        marker.on("click", openDetails);
      } else {
        marker.bindPopup(buildPopupHtml(facility, "", ""), getPopupOptions());
      }
      marker.on("tooltipopen", () => {
        const tooltip = marker.getTooltip();
        const tooltipEl = tooltip ? tooltip.getElement() : null;
        if (!tooltipEl || tooltipEl.dataset.tapBound) {
          return;
        }
        tooltipEl.dataset.tapBound = "true";
        tooltipEl.style.pointerEvents = "auto";
        tooltipEl.style.cursor = "pointer";
        tooltipEl.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          openDetails();
        });
      });

      markers.push({ marker, facility });
    });

    map.on("zoomend", updateLabelOpacity);
    map.whenReady(updateLabelOpacity);

    menuToggle = document.getElementById("menu-toggle");
    const menuBackdrop = document.getElementById("menu-backdrop");
    const sideMenu = document.getElementById("side-menu");
    const menuClose = document.getElementById("menu-close");
    const filterHint = document.getElementById("filter-hint");
    ageSelect = document.getElementById("age-select");
    weekdaySelect = document.getElementById("weekday-select");
    const filterCertified = document.getElementById("filter-certified");
    const filterPrivate = document.getElementById("filter-private");
    const filterMunicipal = document.getElementById("filter-municipal");
    const filterSmall = document.getElementById("filter-small");
    const filterOnsite = document.getElementById("filter-onsite");
    const filterKindergarten = document.getElementById("filter-kindergarten");
    const filterClear = document.getElementById("filter-clear");
    const filterInfo = document.getElementById("filter-info");
    const statusAvailable = document.getElementById("status-available");
    const statusFull = document.getElementById("status-full");
    const statusSummary = document.getElementById("status-summary");

    const setMenuOpen = isOpen => {
      sideMenu.classList.toggle("open", isOpen);
      menuBackdrop.classList.toggle("open", isOpen);
      if (!isOpen && sideMenu.contains(document.activeElement)) {
        menuToggle.focus();
      }
      sideMenu.setAttribute("aria-hidden", String(!isOpen));
      sideMenu.inert = !isOpen;
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    };

    menuToggle.addEventListener("click", () => {
      setMenuOpen(!sideMenu.classList.contains("open"));
    });
    if (menuClose) {
      menuClose.addEventListener("click", () => setMenuOpen(false));
    }
    menuBackdrop.addEventListener("click", () => setMenuOpen(false));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setDetailsOpen(false);
        setAboutOpen(false);
      }
    });
    if (detailsClose) {
      detailsClose.addEventListener("click", () => setDetailsOpen(false));
    }
    if (detailsModal) {
      detailsModal.addEventListener("click", event => {
        if (event.target === detailsModal) {
          setDetailsOpen(false);
        }
      });
    }
    if (aboutButton) {
      aboutButton.addEventListener("click", () => setAboutOpen(true));
    }
    if (aboutClose) {
      aboutClose.addEventListener("click", () => setAboutOpen(false));
    }
    if (aboutModal) {
      aboutModal.addEventListener("click", event => {
        if (event.target === aboutModal) {
          setAboutOpen(false);
        }
      });
    }

    const ageSet = new Set();
    facilities.forEach(facility => {
      (facility.ages || []).forEach(age => ageSet.add(age));
    });
    const ages = Array.from(ageSet).sort((a, b) => a - b);
    ageSelect.innerHTML = "";
    const allAgeOption = document.createElement("option");
    allAgeOption.value = "";
    allAgeOption.textContent = "すべて";
    ageSelect.appendChild(allAgeOption);
    ages.forEach(age => {
      const option = document.createElement("option");
      option.value = String(age);
      option.textContent = `${age}歳`;
      ageSelect.appendChild(option);
    });
    if (!ages.length) {
      ageSelect.disabled = true;
    }

    const weekdays = WEEKDAYS && WEEKDAYS.length ? WEEKDAYS : ["月", "火", "水", "木", "金", "土"];
    weekdaySelect.innerHTML = "";
    const allWeekdayOption = document.createElement("option");
    allWeekdayOption.value = "";
    allWeekdayOption.textContent = "すべて";
    weekdaySelect.appendChild(allWeekdayOption);
    weekdays.forEach(day => {
      const option = document.createElement("option");
      option.value = day;
      option.textContent = day;
      weekdaySelect.appendChild(option);
    });

    if (filterHint) {
      if (ages.length) {
        filterHint.textContent = `対象年齢: ${ages.join(" / ")}歳`;
      } else {
        filterHint.textContent = "対象年齢データがありません。";
      }
    }

    const typeFilters = {
      certified: filterCertified,
      private: filterPrivate,
      municipal: filterMunicipal,
      small: filterSmall,
      onsite: filterOnsite,
      kindergarten: filterKindergarten,
    };
    const isTypeEnabled = source => {
      const control = typeFilters[source];
      return control ? control.checked : true;
    };

    let userLocationMarker = null;
    let userLocationCircle = null;
    let userLocationCircle2km = null;
    let userLocationCircle5km = null;
    let userLocationLabel2km = null;
    let userLocationLabel5km = null;
    map.on("locationfound", event => {
      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }
      if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
      }
      if (userLocationCircle2km) {
        map.removeLayer(userLocationCircle2km);
      }
      if (userLocationCircle5km) {
        map.removeLayer(userLocationCircle5km);
      }
      if (userLocationLabel2km) {
        map.removeLayer(userLocationLabel2km);
      }
      if (userLocationLabel5km) {
        map.removeLayer(userLocationLabel5km);
      }

      userLocationMarker = L.circleMarker(event.latlng, {
        radius: 7,
        color: "#2563eb",
        fillColor: "#60a5fa",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map).bindPopup("現在地");

      userLocationCircle = L.circle(event.latlng, {
        radius: event.accuracy,
        color: "#60a5fa",
        fillColor: "#bfdbfe",
        fillOpacity: 0.2,
        weight: 1,
        interactive: false,
      }).addTo(map);

      userLocationCircle2km = L.circle(event.latlng, {
        radius: 2000,
        color: "#2563eb",
        fillColor: "#bfdbfe",
        fillOpacity: 0.12,
        weight: 2,
        dashArray: "4 6",
        interactive: false,
      }).addTo(map);

      userLocationCircle5km = L.circle(event.latlng, {
        radius: 5000,
        color: "#1d4ed8",
        fillColor: "#dbeafe",
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "4 6",
        interactive: false,
      }).addTo(map);

      userLocationLabel2km = createRangeLabel(
        map,
        event.latlng,
        2000,
        "2km",
        "range-label range-label-2km",
        0.985
      );
      userLocationLabel5km = createRangeLabel(
        map,
        event.latlng,
        5000,
        "5km",
        "range-label range-label-5km"
      );
    });
    map.on("locationerror", event => {
      console.warn("位置情報の取得に失敗しました。", event.message);
      alert("位置情報の取得に失敗しました。ブラウザの許可設定をご確認ください。");
    });

    const updateMarkers = () => {
      const { selectedAge, selectedWeekday } = getSelectedFilters();
      const ageLabel = selectedAge ? `${selectedAge}歳` : "全年齢";
      const weekdayLabel = selectedWeekday ? `${selectedWeekday}曜日` : "全曜日";
      let visible = 0;
      let availableCount = 0;
      let fullCount = 0;
      const shouldShowSummary = Boolean(selectedAge && selectedWeekday);

      markers.forEach(item => {
        const typeEnabled = isTypeEnabled(item.facility.typeKey);
        if (typeEnabled) {
          if (!map.hasLayer(item.marker)) {
            item.marker.addTo(map);
          }
          const statusValue = getAvailabilityStatus(
            item.facility,
            selectedAge,
            selectedWeekday
          );
          const style = resolveMarkerStyle(statusValue);
          item.marker.setStyle(style);
          item.marker.setTooltipContent(
            buildTooltipHtml(item.facility, selectedWeekday, selectedAge)
          );
          if (!isMobileView() && item.marker.getPopup()) {
            item.marker.setPopupContent(
              buildPopupHtml(item.facility, selectedWeekday, selectedAge)
            );
          }
          if (shouldShowSummary) {
            if (style === MARKER_STYLE_AVAILABLE) {
              availableCount++;
            } else if (style === MARKER_STYLE_FULL) {
              fullCount++;
            }
          }
          visible++;
        } else if (map.hasLayer(item.marker)) {
          map.removeLayer(item.marker);
        }
      });

      if (filterInfo) {
        if (selectedAge || selectedWeekday) {
          filterInfo.textContent = `曜日: ${weekdayLabel} / 年齢: ${ageLabel} / 表示中: ${visible}施設`;
        } else {
          filterInfo.textContent = "未選択 / 全施設表示";
        }
      }
      if (statusAvailable) {
        statusAvailable.textContent = `${availableCount}`;
      }
      if (statusFull) {
        statusFull.textContent = `${fullCount}`;
      }
      if (statusSummary) {
        statusSummary.classList.toggle("hidden", !shouldShowSummary);
      }
      if (detailsModal && detailsModal.classList.contains("open")) {
        setDetailsOpen(false);
      }
    };

    ageSelect.addEventListener("change", updateMarkers);
    weekdaySelect.addEventListener("change", updateMarkers);
    if (filterClear) {
      filterClear.addEventListener("click", () => {
        ageSelect.value = "";
        weekdaySelect.value = "";
        updateMarkers();
      });
    }
    Object.values(typeFilters).forEach(control => {
      if (!control) {
        return;
      }
      control.addEventListener("change", updateMarkers);
    });

    updateMarkers();
  }

  main().catch(console.error);
})();

