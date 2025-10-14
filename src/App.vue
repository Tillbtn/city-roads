<template>
  <find-place v-if="!placeFound" @loaded="onGridLoaded"></find-place>
  <div id="app">
    <div v-if="placeFound">
      <div class="controls">
        <a href="#" class="print-button" @click.prevent="toggleSettings"
          >Export</a
        >
        <!-- <a href="#" class="try-another" @click.prevent="startOver"
          >Try another city</a
        > -->
      </div>
      <div v-if="showSettings" class="print-window">
        <div v-if="false" class="row">
          <a href="#" @click.prevent="zazzleMugPrint()" class="col"
            >Onto a mug</a
          >
          <span class="col c-2">
            Print what you see onto a mug. <br />Get a unique gift of your
            favorite city.
          </span>
        </div>
        <div
          class="preview-actions message"
          v-if="zazzleLink || generatingPreview"
        >
          <div v-if="zazzleLink" class="padded popup-help">
            If your browser has blocked the new window, <br />please
            <a :href="zazzleLink" target="_blank">click here</a>
            to open it.
          </div>
          <div v-if="generatingPreview" class="loading-container">
            <loading-icon></loading-icon>
            Generating preview url...
          </div>
        </div>
        <div class="row">
          <a href="#" @click.prevent="toPNGFile" class="col"
            >As an image (.png)</a
          >
          <span class="col c-2">
            Save the current screen as a raster image.
          </span>
        </div>

        <div class="row">
          <a href="#" @click.prevent="toSVGFile" class="col"
            >As a vector (.svg)</a
          >
          <span class="col c-2">
            Save the current screen as a vector image.
          </span>
        </div>
        <div v-if="true" class="row">
          <a href="#" @click.prevent="toProtobuf" class="col">To a .PBF file</a>
          <span class="col c-2">
            Save the current data as a protobuf message. For developer use only.
          </span>
        </div>
      </div>

      <div id="custom-controls" class="controls">
        <div class="input-group">
          <input
            type="text"
            v-model="cityNameInput"
            placeholder="Stadtname eingeben..."
            title="Stadtname"
          />
          <a href="#" class="custom-button" @click.prevent="loadFromCityName"
            >Stadt laden</a
          >
        </div>
        <div class="input-group">
          <input
            type="text"
            v-model="bboxInput"
            placeholder="West, Süd, Ost, Nord"
            title="Bounding Box im Format: West, Süd, Ost, Nord"
          />
          <a href="#" class="custom-button" @click.prevent="loadFromBbox"
            >Laden</a
          >
        </div>
        <a href="#" class="custom-button" @click.prevent="loadRivers"
          >Flüsse laden</a
        >
        <a href="#" class="custom-button" @click.prevent="loadBuildings"
          >Gebäude laden</a
        >
        <a href="#" class="custom-button" @click.prevent="scene.clear()"
          >Karte leeren</a
        >
        <div class="input-group">
          <label for="city-name-input">Titel:</label>
          <input type="text" id="city-name-input" v-model="name" />
        </div>
      </div>

      <div id="layer-list-container" v-if="displayLayers.length > 0">
        <h4>Ebenen</h4>
        <ul>
          <li
            v-for="layer in displayLayers"
            :key="layer.name"
            class="layer-list-item"
          >
            <div
              class="layer-name"
              @click="selectLayer(layer)"
              :class="{ selected: selectedLayerName === layer.name }"
            >
              {{ layer.name }}
            </div>
            <div v-if="selectedLayerName === layer.name" class="layer-controls">
              <div class="control-row">
                <label for="x-offset">X-Offset:</label>
                <input
                  type="number"
                  id="x-offset"
                  v-model.number="xOffsetInput"
                />
              </div>
              <div class="control-row">
                <label for="y-offset">Y-Offset:</label>
                <input
                  type="number"
                  id="y-offset"
                  v-model.number="yOffsetInput"
                />
              </div>
              <div class="control-buttons">
                <a
                  href="#"
                  class="control-btn"
                  @click.prevent="moveSelectedLayer"
                  >Verschieben</a
                >
                <a
                  href="#"
                  class="control-btn reset"
                  @click.prevent="resetSelectedLayerPosition"
                  >Zurücksetzen</a
                >
                <a
                  href="#"
                  class="control-btn delete"
                  @click.prevent="deleteSelectedLayer"
                  >Löschen</a
                >
              </div>
              <div class="color-container">
                <color-picker
                  v-model="layer.color"
                  @change="layer.changeColor"
                ></color-picker>
              </div>
            </div>
          </li>
        </ul>
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
      bboxInput: "13.0633,52.3917,13.0716,52.3985",
      currentBboxArray: null,
      cityNameInput: "Potsdam",
      // for layers
      selectedLayerName: null,
      xOffsetInput: 0,
      yOffsetInput: 0,
    };
  },
  computed: {
    displayLayers() {
      return this.layers;
    },
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
      const parts = this.bboxInput.split(",").map((item) => item.trim());
      if (parts.length !== 4) {
        alert(
          "Ungültiges BBOX-Format. Bitte verwenden Sie vier durch Komma getrennte Werte im Format: West, Süd, Ost, Nord"
        );
        return;
      }
      const [west, south, east, north] = parts;
      const bboxArrayForApi = [south, west, north, east];

      console.log(`Lade neue Karte für BBOX: ${bboxArrayForApi.join(", ")}`);
      this.currentBboxArray = bboxArrayForApi;
      if (window.scene) {
        //window.scene.clear();
        window.scene.load(Query.Road, { bbox: bboxArrayForApi });
      }
    },

    loadRivers() {
      if (!window.scene) return;
      if (!this.currentBboxArray) {
        alert(
          "Konnte aktuelle Ansicht nicht bestimmen. Bitte erst eine Karte laden."
        );
        return;
      }
      console.log("Lade Wasserwege als neue Ebene...");
      let wasserFilter = 'way["waterway"]';
      let wasserEbene = window.scene.load(wasserFilter, {
        bbox: this.currentBboxArray,
      });
      wasserEbene.id = "Wasser";
      wasserEbene.color = "deepskyblue";
    },

    loadBuildings() {
      if (!window.scene) return;
      if (!this.currentBboxArray) {
        alert(
          "Konnte aktuelle Ansicht nicht bestimmen. Bitte erst eine Karte laden."
        );
        return;
      }
      console.log("Lade Gebäude als neue Ebene...");
      let gebaeudeFilter = 'way["building"]';
      let gebaeudeEbene = window.scene.load(gebaeudeFilter, {
        bbox: this.currentBboxArray,
      });
      gebaeudeEbene.id = "Gebäude";
    },

    selectLayer(layer) {
      if (this.selectedLayerName === layer.name) {
        this.selectedLayerName = null;
      } else {
        this.selectedLayerName = layer.name;
        this.xOffsetInput = 0;
        this.yOffsetInput = 0;
      }
    },

    moveSelectedLayer() {
      if (!this.selectedLayerName) return;
      const layerToMove = window.scene.queryLayer(this.selectedLayerName);
      if (!layerToMove) {
        console.error(`Ebene '${this.selectedLayerName}' nicht gefunden.`);
        return;
      }
      console.log(
        `Verschiebe Ebene '${this.selectedLayerName}' um X:${this.xOffsetInput}, Y:${this.yOffsetInput}`
      );
      layerToMove.moveBy(this.xOffsetInput, this.yOffsetInput);
      this.xOffsetInput = 0;
      this.yOffsetInput = 0;
    },

    resetSelectedLayerPosition() {
      if (!this.selectedLayerName) return;
      const layerToReset = window.scene.queryLayer(this.selectedLayerName);
      if (!layerToReset) {
        console.error(`Ebene '${this.selectedLayerName}' nicht gefunden.`);
        return;
      }
      console.log(
        `Setze Position von Ebene '${this.selectedLayerName}' zurück.`
      );
      layerToReset.moveBy(-layerToReset.dx, -layerToReset.dy);
    },

    deleteSelectedLayer() {
      if (!this.selectedLayerName) return;

      const layerToDelete = window.scene.queryLayer(this.selectedLayerName);
      if (!layerToDelete) {
        console.error(`Ebene '${this.selectedLayerName}' nicht gefunden.`);
        return;
      }

      if (
        confirm(
          `Möchten Sie die Ebene '${this.selectedLayerName}' wirklich löschen?`
        )
      ) {
        console.log(`Lösche Ebene '${this.selectedLayerName}'.`);
        window.scene.remove(layerToDelete);
        this.selectedLayerName = null;
      }
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
        this.currentBboxArray = grid.bboxString
          .split(",")
          .map((item) => item.trim());
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
      this.selectedLayerName = null;
    },

    toPNGFile(e) {
      scene.saveToPNG(this.name);
    },

    toSVGFile(e) {
      scene.saveToSVG(this.name);
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

  .input-group label {
    font-size: 14px;
    color: #333;
    margin-right: 8px;
    white-space: nowrap; // Verhindert Umbruch des Labels
  }
}

#layer-list-container {
  background: #f8f8f8;
  width: desktop-controls-width;
  padding: 8px 12px;
  border-top: 1px solid border-color;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1) inset;

  h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
}

.layer-list-item {
  border-bottom: 1px solid #eee;
  &:last-child {
    border-bottom: none;
  }

  .layer-name {
    font-size: 14px;
    padding: 8px 4px;
    color: #333;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;

    &:hover {
      background-color: #efefef;
    }
    &.selected {
      background-color: highlight-color;
      color: white;
    }
  }

  .layer-controls {
    padding: 10px;
    background: #fff;
    border-top: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .control-row {
      display: flex;
      align-items: center;
      gap: 8px;

      label {
        font-size: 12px;
        width: 60px; // Sorgt für saubere Ausrichtung
      }
      input {
        flex-grow: 1;
        padding: 4px;
        border: 1px solid #ccc;
        border-radius: 3px;
      }
    }

    .control-buttons {
      display: flex;
      gap: 8px;
      margin-top: 4px;

      .control-btn {
        flex-grow: 1;
        padding: 6px;
        text-align: center;
        text-decoration: none;
        background: #f0f0f0;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 12px;

        &:hover {
          background: #e0e0e0;
          border-color: #bbb;
        }
        &.reset {
          background: #fdf0f0;
          border-color: #e9c0c0;
          color: #c0392b;
          &:hover {
            background: #fbe0e0;
          }
        }
        &.delete {
          background: #e74c3c;
          border-color: #c0392b;
          color: white;
          &:hover {
            background: #c0392b;
          }
        }
      }
    }
  }
}
</style>
