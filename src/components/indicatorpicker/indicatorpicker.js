import * as utils from "base/utils";
import Component from "base/component";
import Entities from "models/entities";
import Hook from "models/hook";
import Marker from "models/marker";

import {
  question as iconQuestion
} from "base/iconset";

/*!
 * VIZABI INDICATOR PICKER
 * Reusable indicator picker component
 */

const IndPicker = Component.extend({

  /**
     * Initializes the Indicator Picker.
     * Executed once before any template is rendered.
     * @param config The options passed to the component
     * @param context The component's parent
     */
  init(config, context) {

    this.name = "gapminder-indicatorpicker";
    this.template = '<span class="vzb-ip-holder"><span class="vzb-ip-select"></span><span class="vzb-ip-info"></span></span>';

    const _this = this;

    this.model_expects = [{
      name: "time",
      type: "time"
    }, {
      name: "targetModel"
    }, {
      name: "locale",
      type: "locale"
    }];

    //this.markerID = config.markerID;
    this.showHoverValues = config.showHoverValues || false;
    //if (!config.markerID) utils.warn("indicatorpicker.js complains on 'markerID' property: " + config.markerID);

    this.model_binds = {
      "translate:locale": function(evt) {
        _this.updateView();
      },
      "ready": function(evt) {
        _this.updateView();
      }
    };

    this.model_binds["change:targetModel"] = function(evt, path) {
      if (path.indexOf("." + _this.targetProp) == -1) return;
      _this.updateView();
    };

    //contructor is the same as any component
    this._super(config, context);

    if (this.model.targetModel.isHook() && this.showHoverValues) {
      this.model.targetModel._parent.on("change:highlight", (evt, values) => {
        const mdl = _this.model.targetModel;
        if (!mdl.isHook()) return;
        const marker = mdl._parent;
        if (!_this.showHoverValues || mdl.use == "constant") return;
        const _highlightedEntity = marker.getHighlighted();
        if (_highlightedEntity.length > 1) return;

        if (_highlightedEntity.length) {
          marker.getFrame(_this.model.time.value, frame => {
            if (_this._highlighted || !frame) return;

            const _highlightedEntity = marker.getHighlighted();
            if (_highlightedEntity.length) {
              const KEYS = mdl.getDataKeys();
              let value = frame[mdl._name][utils.getKey(_highlightedEntity[0], KEYS)];

              // resolve strings via the color legend model
              const conceptType = mdl.getConceptprops().concept_type;
              if (value && mdl._type === "color" && ["entity_set", "entity_domain"].includes(conceptType)) {
                const clModel = mdl.getColorlegendMarker();
                if (clModel.label.getItems()[value]) value = clModel.label.getItems()[value];
              }

              _this._highlightedValue = value;

              _this._highlighted = (!_this._highlightedValue && _this._highlightedValue !== 0) || mdl.use !== "constant";
              _this.updateView();
            }
          });
        } else {
          if (values !== null && values !== "highlight") {
            if (values) {
              _this._highlightedValue = values[mdl._name];
              _this._highlighted = (!_this._highlightedValue && _this._highlightedValue !== 0) || mdl.use !== "constant";
            }
          } else {
            _this._highlighted = false;
          }
          _this.updateView();
        }
      });
    }

    this.targetProp = config.targetProp
      || this.model.targetModel instanceof Hook ? "which"
      : (this.model.targetModel instanceof Entities ? "dim"
        : (this.model.targetModel instanceof Marker ? "space"
          : null));
  },

  ready() {
    this.updateView();
  },

  readyOnce() {
    const _this = this;

    this.el_select = d3.select(this.element).select(".vzb-ip-select");

    this.el_select.on("click", () => {
      const rect = _this.el_select.node().getBoundingClientRect();
      const rootEl = _this.root.element instanceof Array ? _this.root.element : d3.select(_this.root.element);
      const rootRect = rootEl.node().getBoundingClientRect();
      const treemenuComp = _this.root.findChildByName("gapminder-treemenu");
      const treemenuColWidth = treemenuComp.activeProfile.col_width;
      const treemenuPaddLeft = parseInt(treemenuComp.wrapper.style("padding-left"), 10) || 0;
      const treemenuPaddRight = parseInt(treemenuComp.wrapper.style("padding-right"), 10) || 0;
      const topPos = rect.bottom - rootRect.top;
      const leftPos = rect.left - rootRect.left - (treemenuPaddLeft + treemenuPaddRight + treemenuColWidth - rect.width) * 0.5;

      treemenuComp
        .targetModel(_this.model.targetModel)
        .alignX("left")
        .alignY("top")
        .top(topPos)
        .left(leftPos)
        .updateView()
        .toggle();
    });

    this.infoEl = d3.select(this.element).select(".vzb-ip-info");
    if (_this.model.targetModel.isHook()) {
      utils.setIcon(this.infoEl, iconQuestion)
        .select("svg").attr("width", "0px").attr("height", "0px");

      this.infoEl.on("click", () => {
        _this.root.findChildByName("gapminder-datanotes").pin();
      });
      this.infoEl.on("mouseover", () => {
        const rect = _this.el_select.node().getBoundingClientRect();
        const rootRect = _this.root.element.getBoundingClientRect();
        const topPos = rect.bottom - rootRect.top;
        const leftPos = rect.left - rootRect.left + rect.width;

        _this.root.findChildByName("gapminder-datanotes").setHook(_this.model.targetModel._name).show().setPos(leftPos, topPos);
      });
      this.infoEl.on("mouseout", () => {
        _this.root.findChildByName("gapminder-datanotes").hide();
      });
    }

  },


  updateView() {
    if (!this._readyOnce) return;

    const _this = this;
    const translator = this.model.locale.getTFunction();

    const targetModel = _this.model.targetModel;
    const which = targetModel[_this.targetProp];
    const type = targetModel._type;

    let concept;
    let selectText;

    if (targetModel instanceof Hook) {
      concept = targetModel.getConceptprops();

      if (this.showHoverValues && this._highlighted) {
        const formatter = targetModel.getTickFormatter();

        selectText = (this._highlightedValue || this._highlightedValue === 0) ? formatter(this._highlightedValue) : translator("hints/nodata");

      } else {
        //Let the indicator "_default" in tree menu be translated differnetly for every hook type
        selectText = (which === "_default") ? translator("indicator/_default/" + type) : (concept.name_short);

      }

    } else {

      // targetModel is marker
      const dataManager = targetModel._root.dataManager;
      selectText = targetModel.space.map(dim => dataManager.getConceptProperty(targetModel._space[dim].dim, "name")).join(", ");

    }

    this.el_select.text(selectText)
      .attr("title", function(d) {
        return this.offsetWidth < this.scrollWidth ? selectText : null;
      });

    // hide info el if no data is available for it to make sense
    const hideInfoEl = concept && !concept.description && !concept.sourceName && !concept.sourceLink;
    this.infoEl.classed("vzb-invisible", hideInfoEl);
  }

});

export default IndPicker;
