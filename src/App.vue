<template>
  <find-place v-if="!placeFound" @loaded="onGridLoaded"></find-place>
  <div id="app">
    <div v-if="placeFound">
      <div class="controls">
        <a href="#" class="print-button" @click.prevent="toggleSettings"
          >Customize...</a
        >
        <a href="#" class="try-another" @click.prevent="startOver"
          >Try another city</a
        >
      </div>

      <div id="custom-controls" class="controls">
        <div class="input-group">
          <input
            type="text"
            v-model="cityNameInput"
            placeholder="Stadtname eingeben..."
            title="Stadtname">
          <a href="#" class="custom-button" @click.prevent="loadFromCityName">Stadt laden</a>
        </div>
        <div class="input-group">
          <input
            type="text"
            v-model="bboxInput"
            placeholder="West, Süd, Ost, Nord"
            title="Bounding Box im Format: West, Süd, Ost, Nord">
          <a href="#" class="custom-button" @click.prevent="loadFromBbox">Laden</a>
        </div>
        <a href="#" class="custom-button" @click.prevent="loadRivers">Flüsse laden</a>
        <a href="#" class="custom-button" @click.prevent="loadBuildings">Gebäude laden</a>
        <a href="#" class="custom-button" @click.prevent="scene.clear()">Karte leeren</a>
      </div>

      <div v-if="showSettings" class="print-window">
        <h3>Display</h3>
        </div>
    </div>
  </div>

  <editable-label
    v-if="placeFound"
    v-model="name"
    class="city-name"
    :printable="true"
    :style="{ color: labelColorRGBA }"
    :overlay-manager="overlayManager"
  ></editable-label>
  <div
    v-if="placeFound"
    class="license printable can-drag"
    :style="{ color: labelColorRGBA }"
  >
    data
    <a
      href="https://www.openstreetmap.org/about/"
      target="_blank"
      :style="{ color: labelColorRGBA }"
      >© OpenStreetMap</a
    >
  </div>
</template>

<script>
import FindPlace from "./components/FindPlace.vue";
import LoadingIcon from "./components/LoadingIcon.vue";
import EditableLabel from "./components/EditableLabel.vue";
import ColorPicker from "./components/ColorPicker.vue";
import createScene from "./lib/createScene.js";
import GridLayer from "./lib/GridLayer.js";
import generateZazzleLink from "./lib/getZazzleLink.js";
import appState from "./lib/appState.js";
import { getPrintableCanvas, getCanvas } from "./lib/saveFile.js";
import config from "./config.js";
import "./lib/canvas2BlobPolyfill.js";
import bus from "./lib/bus.js";
import createOverlayManager from "./createOverlayManager.js";
import tinycolor from "tinycolor2";

class ColorLayer {
  constructor(name, color, callback) {
    this.name = name;
    this.changeColor = callback;
    this.color = color;
  }
}

export default {
  name: "App",
  components: {
    FindPlace,
    LoadingIcon,
    EditableLabel,
    ColorPicker,
  },
  data() {
    return {
      placeFound: false,
      name: "",
      zazzleLink: null,
      generatingPreview: false,
      showSettings: false,
      settingsOpen: false,
      labelColor: config.getLabelColor().toRgb(),
      backgroundColor: config.getBackgroundColor().toRgb(),
      layers: [],
      bboxInput: '13.0633,52.3917,13.0716,52.3985',
      currentBboxArray: null,
      cityNameInput: 'Potsdam'
    };
  },
  computed: {
    labelColorRGBA() {
      return toRGBA(this.labelColor);
    },
  },
  created() {
    bus.on("scene-transform", this.handleSceneTransform);
    bus.on("background-color", this.syncBackground);
    bus.on("line-color", this.syncLineColor);
    this.overlayManager = createOverlayManager();
  },
  beforeUnmount() {
    debugger;
    this.overlayManager.dispose();
    this.dispose();
    bus.off("scene-transform", this.handleSceneTransform);
    bus.off("background-color", this.syncBackground);
    bus.off("line-color", this.syncLineColor);
  },
  methods: {
    loadFromCityName() {
      if (!this.cityNameInput) {
        alert("Bitte geben Sie einen Stadtnamen ein.");
        return;
      }
      console.log(`Lade neue Karte für Stadt: ${this.cityNameInput}`);
      this.currentBboxArray = null;
      if (window.scene) {
        //window.scene.clear();
        window.scene.load(Query.Road, this.cityNameInput);
      }
    },

    loadFromBbox() {
      if (!this.bboxInput) {
        alert("Bitte geben Sie eine Bounding Box ein.");
        return;
      }
      const parts = this.bboxInput.split(',').map(item => item.trim());
      if (parts.length !== 4) {
        alert("Ungültiges BBOX-Format. Bitte verwenden Sie vier durch Komma getrennte Werte im Format: West, Süd, Ost, Nord");
        return;
      }
      const [west, south, east, north] = parts;
      const bboxArrayForApi = [south, west, north, east];

      console.log(`Lade neue Karte für BBOX: ${bboxArrayForApi.join(', ')}`);
      this.currentBboxArray = bboxArrayForApi;
      if (window.scene) {
        //window.scene.clear();
        window.scene.load(Query.Road, { bbox: bboxArrayForApi });
      }
    },

    loadRivers() {
      if (!window.scene) return;
      if (!this.currentBboxArray) {
        alert("Konnte aktuelle Ansicht nicht bestimmen. Bitte erst eine Karte laden.");
        return;
      }
      console.log("Lade Wasserwege als neue Ebene...");
      let wasserFilter = 'way["waterway"]';
      let wasserEbene = window.scene.load(wasserFilter, { bbox: this.currentBboxArray });
      wasserEbene.id = 'Wasser';
      wasserEbene.color = 'deepskyblue';
    },

    loadBuildings() {
      if (!window.scene) return;
      if (!this.currentBboxArray) {
        alert("Konnte aktuelle Ansicht nicht bestimmen. Bitte erst eine Karte laden.");
        return;
      }
      console.log("Lade Gebäude als neue Ebene...");
      let gebaeudeFilter = 'way["building"]';
      let gebaeudeEbene = window.scene.load(gebaeudeFilter, { bbox: this.currentBboxArray });
      gebaeudeEbene.id = 'Gebäude';
    },

    dispose() {
      if (this.scene) {
        this.scene.dispose();
        window.scene = null;
      }
    },
    toggleSettings() {
      this.showSettings = !this.showSettings;
    },
    handleSceneTransform() {
      this.zazzleLink = null;
    },
    onGridLoaded(grid) {
      if (grid.isArea) {
        appState.set("areaId", grid.id);
        appState.unset("osm_id");
        appState.unset("bbox");
      } else if (grid.bboxString) {
        appState.unset("areaId");
        appState.set("osm_id", grid.id);
        appState.set("bbox", grid.bboxString);
        this.currentBboxArray = grid.bboxString.split(',').map(item => item.trim());
      }
      this.placeFound = true;
      this.name = grid.name.split(",")[0];
      let canvas = getCanvas();
      canvas.style.visibility = "visible";

      this.scene = createScene(canvas);
      this.scene.on("layer-added", this.updateLayers);
      this.scene.on("layer-removed", this.updateLayers);

      window.scene = this.scene;

      let gridLayer = new GridLayer();
      gridLayer.id = "lines";
      gridLayer.setGrid(grid);
      this.scene.add(gridLayer);
    },

    startOver() {
      appState.unset("areaId");
      appState.unsetPlace();
      appState.unset("q");
      appState.enableCache();

      this.dispose();
      this.placeFound = false;
      this.zazzleLink = null;
      this.showSettings = false;
      this.backgroundColor = config.getBackgroundColor().toRgb();
      this.labelColor = config.getLabelColor().toRgb();

      document.body.style.backgroundColor = config
        .getBackgroundColor()
        .toRgbString();
      getCanvas().style.visibility = "hidden";
      this.currentBboxArray = null;
    },

    toPNGFile(e) {
      scene.saveToPNG(this.name);
    },

    toSVGFile(e) {
      scene.saveToSVG(this.name)
    },

    updateLayers() {
      // TODO: This method likely doesn't belong here
      let newLayers = [];
      let lastLayer = 0;
      let renderer = this.scene.getRenderer();
      let root = renderer.getRoot();
      root.children.forEach((layer) => {
        if (!layer.color) return;
        let name = layer.id;
        if (!name) {
          lastLayer += 1;
          name = "lines " + lastLayer;
        }
        let layerColor = tinycolor.fromRatio(layer.color);
        newLayers.push(
          new ColorLayer(name, layerColor, (newColor) => {
            this.zazzleLink = null;
            layer.color = toRatioColor(newColor);
            renderer.renderFrame();
            this.scene.fire("color-change", layer);
          })
        );
      });

      newLayers.push(
        new ColorLayer(
          "background",
          this.backgroundColor,
          this.setBackgroundColor
        ),
        new ColorLayer(
          "labels",
          this.labelColor,
          (newColor) => (this.labelColor = newColor)
        )
      );

      this.layers = newLayers;

      function toRatioColor(c) {
        return { r: c.r / 0xff, g: c.g / 0xff, b: c.b / 0xff, a: c.a };
      }
      this.zazzleLink = null;
    },

    syncLineColor() {
      this.updateLayers();
    },

    syncBackground(newBackground) {
      this.backgroundColor = newBackground.toRgb();
      this.updateLayers();
    },
    // TODO: I need two background methods?
    updateBackground() {
      this.setBackgroundColor(this.backgroundColor);
      this.zazzleLink = null;
    },
    setBackgroundColor(c) {
      this.scene.background = c;
      document.body.style.backgroundColor = toRGBA(c);
      this.zazzleLink = null;
    },

    zazzleMugPrint() {
      if (this.zazzleLink) {
        window.open(this.zazzleLink, "_blank");
        recordOpenClick(this.zazzleLink);
        return;
      }

      this.generatingPreview = true;
      getPrintableCanvas(this.scene).then((printableCanvas) => {
        generateZazzleLink(printableCanvas)
          .then((link) => {
            this.zazzleLink = link;
            window.open(link, "_blank");
            recordOpenClick(link);
            this.generatingPreview = false;
          })
          .catch((e) => {
            this.error = e;
            this.generatingPreview = false;
          });
      });
    },
    logHello() {
      console.log("Hello");
    },
    logCustom() {
      console.log(this.logInput);
    },
  },
};

function toRGBA(c) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function recordOpenClick(link) {
  if (typeof gtag === "undefined") return;

  gtag("event", "click", {
    event_category: "Outbound Link",
    event_label: link,
  });
}
</script>

<style lang="stylus">
@import('./vars.styl');

#app {
  margin: 8px;
  max-height: 100vh;
  position: absolute;
  z-index: 1;
  h3 {
    font-weight: normal;
  }
}

.can-drag {
  border: 1px solid transparent;
}
.controls {
  height: 48px;
  background: white;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: desktop-controls-width;
  justify-content: space-around;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 -1px 0px rgba(0,0,0,0.02);

  a {
    text-decoration: none;
    display: flex;
    justify-content: center;
    align-items: center;
    color: highlight-color;
    margin: 0;
    border: 0;
    &:hover {
      color: emphasis-background;
      background: highlight-color;
    }
  }
  a.try-another {
    flex: 1;
  }

  a.print-button {
    flex: 1;
    border-right: 1px solid border-color;
    &:focus {
      border: 1px dashed highlight-color;
    }
  }
}

#custom-controls {
  margin-top: 4px;
  padding: 8px;
  height: auto;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;

  a.custom-button {
    flex: 0 1 auto;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid border-color;
    background: #f5f5f5;
    text-align: center;
    &:hover {
      border-color: highlight-color;
    }
  }

  .input-group {
    display: flex;
    width: 100%;
  }

  input[type="text"] {
    padding: 7px;
    border: 1px solid border-color;
    border-radius: 4px;
    font-size: 14px;
    flex-grow: 1;
    margin-right: -1px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .input-group a.custom-button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    width: auto;
  }
}

.col {
    display: flex;
    flex: 1;
    select {
      margin-left: 14px;
    }
  }
</style>
