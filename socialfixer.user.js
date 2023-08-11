// ==UserScript==
//
//  ////////////////////////////////////
//  //                                //
//  //  IF YOU ARE SEEING THIS (not   //
//  //  in the Userscript manager),   //
//  //  your Userscript manager AKA   //
//  //  'monkey' is malfunctioning.   //
//  //                                //
//  //  See socialfixer.com/ujs-help  //
//  //                                //
//  ////////////////////////////////////
//
// @name           Social Fixer for Facebook
// @namespace      http://userscripts.org/users/864169999
// @include        /^https:\/\/facebook\.com\//
// @include        /^https:\/\/[^\/]*\.facebook\.com\//
// @include        /^https:\/\/[^\/]*\.messenger\.com\//
// @exclude        /^https:\/\/[^\/]*(channel|static)[^\/]*facebook\.com\//
// @exclude        /^https:\/\/[^\/]*facebook\.com\/.*(ai.php|morestories.php|generic.php|xti.php|plugins|connect|ajax|sound_iframe|l.php\?u)/
// @exclude        /^https:\/\/[^\/]*\.facebook\.com\/help/
// @exclude        /^https:\/\/[^\/]*\.facebook\.com\/support/
// @exclude        /^https:\/\/[^\/]*\.facebook\.com\/saved/
// @connect        www.facebook.com
// @connect        mbasic.facebook.com
// @connect        socialfixer.com
// @connect        matt-kruse.github.io
// @connect        fbcdn.net
// @run-at         document-start
// @noframes
// @version        30.0.0
// @downloadURL    https://socialfixer.com/socialfixer.user.js
// @supportURL     https://socialfixer.com/support
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @grant          GM.getValue
// @grant          GM.setValue
// @grant          GM.xmlHttpRequest
// @grant          unsafeWindow
// ==/UserScript==
/*
Social Fixer
(c) 2009-2023 Matt Kruse
https://SocialFixer.com/
*/

/*
 * Decide if we're supposed to be running at all.
 */
var prevent_running = false;

if (window.top != window.self ||                                      // We don't run in frames
    !location || /[?#&]no_sfx/.test(location.href) ||                 // URL keyword to disable
    /\/plugins\/|\/(l|ai|morestories)\.php$/.test(location.pathname)  // Avoid some FB features
   ) prevent_running = true;


var define, exports; // Guard against global scope leak in ViolentMonkey extension

const use_Promise_getValue = (typeof GM === 'object' && typeof GM.getValue === 'function');
const use_Promise_setValue = (typeof GM === 'object' && typeof GM.setValue === 'function');
const use_GM_xmlhttpRequest = (typeof GM === 'object' && typeof GM.xmlHttpRequest === 'function');
const GM_xhr = (typeof GM === 'object' && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest : GM_xmlhttpRequest;

// Extension API
var Extension = (function() {
    var api = {
        "storage": {
            "get":
                function(keys, defaultValue, callback, prefix) {
                    // Keys can be either a single keys or an array of keys
                    if (typeof keys=="string") {
                        use_Promise_getValue
                            ? GM.getValue(prefix+keys,defaultValue)
                                .then(callback)
                            : callback(GM_getValue(prefix+keys,defaultValue));
                    }
                    else if (typeof keys=="object" && keys.length) {
                        var values = {};
                        var awaiting = keys.length;
                        for (let i=0; i<keys.length; i++) {
                            var default_value;
                            if (typeof defaultValue=="object" && defaultValue.length && i<defaultValue.length) {
                                default_value = defaultValue[i];
                            }
                            use_Promise_getValue
                                ? GM.getValue(prefix+keys[i],default_value)
                                    .then((value)=>(values[keys[i]]=value))
                                    .finally(()=>--awaiting||callback(values))
                                : (values[keys[i]] = GM_getValue(prefix+keys[i],default_value));

                        }
                        use_Promise_getValue || callback(values);
                    }
                    return;
                }
            ,
            "set":
                function(key,val,callback, prefix) {
                    typeof callback === 'function' || (callback = (() => undefined));
                    setTimeout(function() {
                        use_Promise_setValue
                            ? GM.setValue(prefix+key,val)
                                .then((ret)=>callback(key,val,ret))
                                .catch((e)=>callback(key,val,e))
                            : callback(key,val,GM_setValue(prefix+key,val));
                    },0);
                }
        },
        "ajax":function(urlOrObject,callback) {
            const xhrEventHandler = function (xhr) {
                const headers = {};
                xhr.responseHeaders.split(/\r?\n/).forEach(function (header) {
                    const val = header.split(/\s*:\s*/, 2);
                    headers[val[0].toLowerCase()] = val[1];
                });
                callback(xhr.responseText, xhr.status, headers);
            };
            const method = urlOrObject.method || 'GET';
            const timeout = urlOrObject.timeout || 5.0 * X.seconds;
            const url = urlOrObject.url || urlOrObject;
            if (!url) {
                alert("Invalid parameter passed to Extension.ajax");
                return callback(null);
            }
            const details = { method, timeout, url, onload: xhrEventHandler, };
            ['error', 'abort', 'timeout'].forEach(event =>
                (details[`on${event}`] = () => xhrEventHandler({ responseText: event, status: 418, responseHeaders: '', })));
            GM_xhr(details);
        },
    };
    return api;
})();

const sfx_style = `
.sfx_bubble_note {
  position: fixed;
  min-height: 50px;
  min-width: 150px;
  max-height: 90vh;
  max-width: 50vw;
  margin: 10px;
  font-family: arial;
  background-color: #FFFFE5;
  color: black;
  border: 1px solid #3F5C71;
  font-size: calc(0.7rem * var(--sfx_ui_scale));
  padding: 10px;
  border-radius: 6px;
  box-shadow: 0 0 5px #888888;
  z-index: 99999 !important;
  cursor: move;
  overflow: auto;
}
.sfx_bubble_note .sfx_bubble_note_title {
  font-size: calc(0.8rem * var(--sfx_ui_scale));
  font-weight: bold;
  margin: 10px 0;
}
.sfx_bubble_note .sfx_bubble_note_subtitle {
  font-size: calc(0.7rem * var(--sfx_ui_scale));
  font-weight: bold;
  margin: 5px 0;
}
.sfx_bubble_note .sfx_bubble_note_data {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: calc(0.65rem * var(--sfx_ui_scale));
  background-color: #ddd;
  overflow: auto;
  max-height: 50vh;
}
.sfx_bubble_note_top_right {
  right: 0;
  top: 0;
}
.sfx_bubble_note_bottom_right {
  right: 0;
  bottom: 0;
}
.sfx_bubble_note_top_left {
  left: 0;
  top: 0;
}
.sfx_bubble_note_bottom_left {
  left: 0;
  bottom: 0;
}

/* Comment Button */
.sfx_comment_button {
  float: right;
  padding: 4px 8px;
  margin: 4px;
  background-color: #5A74A8 !important;
  border: 1px solid #1A356E;
  color: white;
  font-weight: bold;
  font-size: calc(0.6rem * var(--sfx_ui_scale)) !important;
  line-height: 12px !important;
  border-radius: 3px;
}
.sfx_comment_button_msg {
  float: right;
  display: inline-block;
  padding: 5px 4px;
  color: #9197A3;
}

.sfx_expander_ui {
  max-height: 50ex;
  width: 30em;
  overflow-y: scroll;
}
.sfx_clicked {
  background-color: yellow;
}


#sfx_control_panel {
  position: fixed;
  min-width: 150px;
  max-width: 250px;
  border-radius: 3px;
  background-color: white;
  color: #404040;
  z-index: 201;
  opacity: 0.6;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  box-shadow: 0 0 5px rgba(105, 118, 136, 0.2), 0 5px 5px rgba(132, 143, 160, 0.2), 0 10px 10px rgba(132, 143, 160, 0.2), 0 20px 20px rgba(132, 143, 160, 0.2), 0 0 5px rgba(105, 118, 136, 0.3);
}
#sfx_control_panel:hover {
  opacity: 1;
}
#sfx_control_panel .sfx_cp_header {
  font-weight: bold;
  cursor: move;
  margin-bottom: 2px;
  font-size: calc(0.45rem * var(--sfx_ui_scale));
  letter-spacing: 1px;
  text-transform: uppercase;
  vertical-align: top;
  padding: 5px;
  border-radius: 3px 3px 0 0;
  text-align: left;
  border: 0;
  color: #fff;
  background: linear-gradient(to right, #2C4372, #3B5998);
}
#sfx_control_panel .sfx_cp_section_label {
  background-color: #eee;
  font-size: calc(0.5rem * var(--sfx_ui_scale));
  font-family: arial,sans serif;
  font-weight: bold;
  padding: 3px;
}
#sfx_control_panel .sfx_cp_section_content {
  margin-bottom: 5px;
}
.sfx_why_cp_filters {
  margin: 5px;
  border: 2px solid grey;
  padding: 5px;
}
.sfx_close_cp_refresh {
  margin-left: 10px;
  margin-right: 2px;
}
.sfx_cp_close_button {
  float: right;
  display: inline-block;
  width: 10px;
  cursor: pointer;
  text-align: center;
  border: 1px solid #aaa;
  border-radius: 4px;
  font-weight: normal;
  letter-spacing: 0;
}

*[sfx_update_count]:before {
  display: block;
  border: 2px solid orange;
  border-radius: 5px;
  padding: 5px;
  background-color: white;
  content: "Updates: [" attr(sfx_update_count) "] " attr(sfx_update_tracking);
}

.sfx_insert_step_1 {
  margin: 2px;
  outline: 2px solid red;
}
.sfx_insert_step_2 {
  margin: 2px;
  outline: 2px solid green;
}
.sfx_insert_step_3 {
  margin: 2px;
  outline: 2px solid blue;
}
.sfx_insert_step_4 {
  margin: 2px;
  outline: 2px solid orange;
}
.sfx_insert_step_5 {
  margin: 2px;
  outline: 2px solid purple;
}
.sfx_insert_step_6 {
  margin: 2px;
  outline: 2px solid lime;
}
.sfx_insert_step_7 {
  margin: 2px;
  outline: 2px solid cyan;
}

.sfx_debug_tab {
  opacity: 0.5;
}
.sfx_debug_tab:hover {
  opacity: 1;
}

#sfx_debugger {
  position: fixed;
  bottom: 0;
  right: 0;
  border: 1px solid black;
  background-color: white;
  color: black;
  z-index: 99999;
}
#sfx_debugger_results {
  width: 40vw;
  height: 75vh;
  overflow: auto;
  clear: both;
  font-family: monospace !important;
}
#sfx_debugger_controls {
  border-bottom: 1px solid #333;
}
#sfx_debugger_controls > div {
  margin: 2px;
}
#sfx_debugger_url {
  margin-left: 10px;
  max-width: 400px;
  text-overflow: ellipsis;
  display: inline-block;
  white-space: nowrap;
}
.sfx_debugger_result {
  border: 1px solid #666;
  margin: 8px;
}
.sfx_debugger_subresult {
  border: 1px solid #ccc;
  margin: 3px;
}
.sfx_debugger_subresult:hover {
  background-color: #F2F4FF;
  cursor: pointer;
}
.sfx_debugger_button {
  float: right;
  height: 16px;
  width: 16px;
  cursor: pointer;
  text-align: center;
  padding: 3px;
  margin: 3px;
  font-size: calc(0.8rem * var(--sfx_ui_scale));
  font-weight: bold;
}
.sfx_debugger_button:hover {
  outline: 1px solid #ccc;
}
.sfx_debugger_warning {
  font-weight: bold;
  color: red;
}
.sfx_debugger_text_header {
  color: #666;
  float: right;
  margin: 1px;
}
.sfx_debugger_action {
  cursor: pointer;
  margin-left: 10px;
  display: inline-block;
}
.sfx_debugger_action:hover {
  text-decoration: underline;
}

.sfx_edit_buf_button {
  padding: 4px;
  outline: 2px solid black;
}
.sfx_edit_buf_button .sfx_edit_buf_selected {
  outline: 2px solid red;
}
.sfx_edit_buf_toggle {
  font-weight: normal;
  color: black;
}
.sfx_edit_buf_post_show {
  display: block !important;
  box-shadow: 5px 5px 5px blue, -5px -5px 5px red;
  opacity: 1;
}
.sfx_edit_buf_post_show > ._4-u2 {
  opacity: 1 !important;
}

/*ELEMENTS*/
/* REUSABLE STYLES */
.sfx_info {
  font-size: calc(0.6rem * var(--sfx_ui_scale));
}
input.sfx_input {
  padding-left: 0.2em;
  border: 1px solid #bec4cd;
  border-radius: 2px;
}
/* BUTTONS */
.sfx_button {
  background-color: #4267B2;
  border: 1px solid #4267B2;
  color: white;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  line-height: 22px;
  cursor: pointer;
  border-radius: 3px;
  padding: 2px 8px;
  font-weight: bold;
}
.sfx_button:hover {
  background-color: #365899;
}
.sfx_button.secondary {
  background-color: #e7e9ef;
  color: #000000;
  border-color: #d7dce5;
}
.sfx_button.secondary:hover {
  background-color: #d0d5e0;
}
.sfx_button.light {
  color: black;
  padding: 5px 8px;
  background-color: #f6f7f9;
  border: 1px solid #ced0d4;
  border-radius: 2px;
}
/* DIALOG BOXES */
.sfx_dialog_title_bar {
  padding: 10px 12px;
  font-weight: bold;
  line-height: 28px;
  min-height: 28px;
  margin: -10px -10px 0;
  border: 0;
  margin-bottom: 10px;
  color: #fff;
  font-size: calc(0.5rem * var(--sfx_ui_scale));
  letter-spacing: 4px;
  text-transform: uppercase;
  vertical-align: top;
  background: linear-gradient(to right, #2C4372, #3B5998 80%);
}
.sfx_dialog_title_bar .sfx_button {
  letter-spacing: normal !important;
  background-color: #253860;
  border: 0;
}
.sfx_dialog_title_bar .sfx_button.secondary {
  background-color: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 0;
  font-weight: normal;
}
.sfx_dialog {
  z-index: 99999;
  overflow: hidden;
  position: fixed;
  top: 48px;
  left: 20px;
  width: 90vw;
  min-width: 500px;
  max-width: 1000px;
  max-height: 90vh;
  font-family: helvetica, arial, sans-serif;
  transition: height 0.5s linear;
  color: #404040;
  border: 0;
  border-radius: 3px;
  padding: 10px;
  background-color: #E9EBEE;
  box-shadow: 0 0 5px rgba(105, 118, 136, 0.2), 0 5px 5px rgba(132, 143, 160, 0.2), 0 10px 10px rgba(132, 143, 160, 0.2), 0 20px 20px rgba(132, 143, 160, 0.2);
}
#sfx_options_dialog_sections {
  flex: none;
  width: 125px;
}
#sfx_options_dialog_content {
  padding: 10px;
}
#sfx_options_dialog_body {
  background-color: white;
}
.sfx_options_dialog_section {
  padding: 6px 5px 6px 10px;
  background-color: #F6F7F9;
  font-weight: bold;
  margin: 2px;
  cursor: pointer;
}
.sfx_options_dialog_section.selected {
  background-color: #4267B2;
  color: white;
  cursor: auto;
}
/*END ELEMENTS*/

.sfx_data_table {
  border-collapse: collapse;
}
.sfx_data_table th {
  font-weight: bold;
  background-color: #ccc;
  padding: 5px;
  border: 1px solid #666;
}
.sfx_data_table th.sortable {
  cursor: pointer;
}
.sfx_data_table th.sortable:hover {
  text-decoration: underline;
}
.sfx_data_table td {
  padding: 1px 5px;
  border: 1px solid #ddd;
}

html:not(.sfx_hide_show_all) .sfx_hide_hidden {
  display: none !important;
}
.sfx_hide_frame {
  position: absolute;
  z-index: 99999;
  background-color: rgba(0, 255, 0, 0.2);
  outline: 2px solid lime;
  margin: 0 !important;
  font-weight: bold;
  text-align: center;
  color: transparent;
}
.sfx_hide_frame_hidden {
  color: white;
  background-color: rgba(255, 0, 0, 0.2);
  outline: 2px solid red;
}
.sfx_hide_frame_hidden:hover {
  outline: 2px dashed green;
}
.sfx_hide_frame:hover {
  outline: 2px dashed red;
  background-color: rgba(218, 165, 32, 0.5);
  color: black;
  cursor: pointer;
}
.sfx_hide_bubble {
  max-width: 400px;
}
.sfx_hide_bubble > div {
  margin: 10px 0;
}
.sfx_hide_bubble .sfx_button {
  margin-left: auto;
  margin-right: auto;
}
.sfx_hide_bubble label {
  font-weight: normal;
  color: black;
}
.sfx_hide_show_overflow.sfx_hide_show_overflow {
  overflow: visible !important;
}
.sfx_hide_checkmark {
  filter: invert(1);
  background-repeat: no-repeat;
}
[data-hover='hider-tooltip'][data-hider-title]:hover::after {
  color: blue;
  background-color: white;
  font-size: large;
  font-weight: bold;
  line-height: calc(0.75rem * var(--sfx_ui_scale));
  text-transform: none;
  text-align: center;
  content: attr(data-hider-title);
  border: 4px solid blueviolet;
  border-radius: 12px;
  padding: 2px;
  margin: 0px;
  min-width: calc(4rem * var(--sfx_ui_scale));
  width: auto;
  max-width: calc(22rem * var(--sfx_ui_scale));
  height: auto;
  max-height: calc(6rem * var(--sfx_ui_scale));
  position: absolute;
  display: block;
  pointer-events: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  overflow: visible;
  z-index: 200000;
  opacity: 0.75;
}
/* Special adjustment for the tooltips inside the Hide/Show box */
.sfx_hide_bubble [data-hover='hider-tooltip']:hover::after {
  transform: none;
  top: 75%;
  left: 37%;
  right: 33%;
}
/* Position the corner tooltips */
.sfx_hide_bubble [style*=right][style*=bottom]:hover::after {
  transform: translate(calc(-4.5rem * var(--sfx_ui_scale)), calc(-3rem * var(--sfx_ui_scale)));
}
.sfx_hide_bubble [style*=right]:hover::after {
  transform: translate(calc(-4.5rem * var(--sfx_ui_scale)), 0);
}
.sfx_hide_bubble [style*=bottom]:hover::after {
  transform: translate(0, calc(-3rem * var(--sfx_ui_scale)));
}
/* Tooltip delays */
@-webkit-keyframes sfx_tooltip_anim {
  from {
    opacity: 0;
  }
  30% {
    opacity: 0;
  }
  to {
    opacity: 0.75;
  }
}
@keyframes sfx_tooltip_anim {
  from {
    opacity: 0;
  }
  30% {
    opacity: 0;
  }
  to {
    opacity: 0.75;
  }
}
[data-hover='hider-tooltip']:not([data-hider-delay]):hover::after {
  -webkit-animation: sfx_tooltip_anim 0.1s;
          animation: sfx_tooltip_anim 0.1s;
}
[data-hover='hider-tooltip'][data-hider-delay='650']:hover::after {
  -webkit-animation: sfx_tooltip_anim 0.65s;
          animation: sfx_tooltip_anim 0.65s;
}
[data-hover='hider-tooltip'][data-hider-delay='1000']:hover::after {
  -webkit-animation: sfx_tooltip_anim 1s;
          animation: sfx_tooltip_anim 1s;
}

#sfx_log_viewer {
  position: fixed;
  bottom: 0;
  right: 0;
  border: 1px solid black;
  background-color: white;
  color: black;
  z-index: 99999;
}
#sfx_log_viewer_entries {
  width: 40vw;
  height: 50vh;
  overflow: auto;
  white-space: pre;
  clear: both;
}
#sfx_log_controls {
  border-bottom: 1px solid #333;
}
.sfx_log_button {
  float: right;
  height: 16px;
  width: 16px;
  cursor: pointer;
  text-align: center;
  padding: 3px;
  margin: 3px;
  font-size: calc(0.8rem * var(--sfx_ui_scale));
  font-weight: bold;
}
.sfx_log_button:hover {
  outline: 1px solid #ccc;
}
.sfx_log_entry {
  font-family: monospace !important;
}

.sfx_hide_read .sfx_post_read:not(.sfx_show_read) > :not(.sfx_read_note) {
  display: none;
}
html:not(.sfx_hide_read) .sfx_read_note > *,
.sfx_hide_read .sfx_post_read.sfx_show_read .sfx_read_show,
.sfx_hide_read .sfx_post_read:not(.sfx_show_read) .sfx_read_hide {
  display: none;
}
.sfx_hide_read .sfx_post_read:not(.sfx_show_read),
.sfx_filter_hidden:not(.sfx_filter_hidden_show) {
  outline: none;
  border: none;
  margin: 0;
  padding: 0;
  background-color: transparent;
}
.sfx_read_note {
  margin: 1px;
  font-size: calc(0.5rem * var(--sfx_ui_scale));
  cursor: pointer;
  padding: 0 5px;
  color: var(--primary-text) !important;
}
.sfx_cp_mark_all_read input {
  border-radius: 10px;
  font-size: calc(0.55rem * var(--sfx_ui_scale));
  padding: 2px 3px;
  line-height: 12px;
  font-weight: normal;
}
.sfx_cp_mark_all_read input[disabled="true"] {
  background-color: #eee;
  color: #aaa;
}
html[sfx_context_type=marketplace] #sfx_post_action_tray_container {
  position: relative;
  width: 38%;
  left: 70%;
  top: 2%;
  z-index: 1;
}
#sfx_post_action_tray {
  position: absolute;
  right: 32px;
  top: 1px;
  height: 16px;
  overflow: visible;
}
#sfx_post_action_tray > * {
  display: inline-block;
  width: 16px;
  height: 16px;
  float: right;
  cursor: pointer;
  margin-left: 7px;
  opacity: 0.5;
  font-size: calc(0.8rem * var(--sfx_ui_scale));
  line-height: 16px;
  background-color: transparent;
  background-repeat: no-repeat;
  color: #b1b5bb;
  z-index: 350;
}
#sfx_post_action_tray > *:hover {
  opacity: 1;
}
.sfx_post_action_menu {
  position: absolute;
  display: none;
  min-width: 150px;
  margin: 2px;
  padding: 4px;
  cursor: pointer;
  background-color: white;
  border: 1px solid #666;
  z-index: 9999;
}
.sfx_post_action_menu > div {
  padding: 4px 2px 4px 10px;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  font-family: arial, sans-serif;
}
.sfx_post_action_menu > div:hover {
  background-color: #7187B5;
  color: white;
}

.sfx_filter_subscribed {
  opacity: 0.5;
  background-color: #d4ffd3;
}
.sfx_filter_subscribed .sfx_square_add {
  display: none;
}

.sfx_tweak_subscribed {
  opacity: 0.5;
  background-color: #afffbe;
}
.sfx_tweak_subscribed .sfx_square_add {
  display: none;
}

div.sfx_option {
  line-height: 24px;
  vertical-align: middle;
}
div.sfx_option input[type=checkbox]:not(.normal) ~ label {
  float: left;
  margin-right: 5px;
}
.sfx_square_control {
  height: 20px;
  width: 20px;
  cursor: pointer;
  border-radius: 3px;
  padding: 0;
  display: inline-block;
  overflow: hidden;
  text-align: center;
  font-weight: bold;
  font-size: calc(1rem * var(--sfx_ui_scale));
  line-height: 20px;
  background-color: #fff;
  color: #4267B2;
  /*
  &:hover {
    opacity:.9;
  }*/
}
.sfx_square_add {
  height: 20px;
  width: 20px;
  cursor: pointer;
  border-radius: 3px;
  padding: 0;
  display: inline-block;
  overflow: hidden;
  text-align: center;
  font-weight: bold;
  font-size: calc(1rem * var(--sfx_ui_scale));
  line-height: 20px;
  background-color: #fff;
  color: #4267B2;
  /*
  &:hover {
    opacity:.9;
  }*/
  color: white;
  background-color: #42b72a;
  box-shadow: none;
}
.sfx_square_delete {
  color: #a60000;
  background-color: white;
}
.sfx_dialog input[type=checkbox]:not(.normal) {
  display: none;
}
.sfx_dialog input[type=checkbox]:not(.normal) ~ label {
  height: 20px;
  width: 20px;
  cursor: pointer;
  border-radius: 3px;
  padding: 0;
  display: inline-block;
  overflow: hidden;
  text-align: center;
  font-weight: bold;
  font-size: calc(1rem * var(--sfx_ui_scale));
  line-height: 20px;
  background-color: #fff;
  color: #4267B2;
  /*
  &:hover {
    opacity:.9;
  }*/
  box-shadow: inset 0 0 0 2px #3B5998;
  color: white;
}
.sfx_dialog input[type=checkbox]:not(.normal) ~ label:hover {
  opacity: 1;
}
.sfx_dialog input[type=checkbox]:not(.normal):checked ~ label {
  background-color: #3B5998;
  color: #fff;
}
.sfx_dialog input[type=checkbox]:not(.normal):checked ~ label:after {
  content: '\\2714';
  height: 20px;
  width: 20px;
  display: inline-block;
  font-size: calc(1rem * var(--sfx_ui_scale));
  line-height: 20px;
  color: white;
}
/* Options List Table */
.sfx_options_dialog_table {
  border-collapse: collapse;
  border-spacing: 0;
  border-bottom: 1px solid #ccc;
  width: 95%;
  margin-top: 10px;
  margin-bottom: 5px;
}
.sfx_options_dialog_table thead {
  border-bottom: 2px solid #4267B2;
}
.sfx_options_dialog_table thead tr th {
  text-align: left;
  font-weight: bold;
  padding: 3px 5px;
  color: #4267B2;
}
.sfx_options_dialog_table tbody tr:hover td {
  background-color: #E9EBEE;
}
.sfx_options_dialog_table tbody td {
  border-top: 1px solid #ccc;
  padding: 3px;
  vertical-align: top;
}
.sfx_options_dialog_table tbody td.repeat {
  border-top: none;
  visibility: hidden;
}
.sfx_options_dialog_table .sfx_options_dialog_option_highlighted {
  background-color: #afffbe !important;
}
.sfx_options_dialog_table .sfx_options_dialog_option_title {
  font-size: calc(0.55rem * var(--sfx_ui_scale));
  font-weight: bold;
  width: 160px;
  padding-right: 20px;
}
.sfx_options_dialog_table .sfx_options_dialog_option_description {
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  color: #5a5a5a;
}
.sfx_options_dialog_table .sfx_options_dialog_option_action {
  padding-right: 10px;
  padding-left: 10px;
}
.sfx_options_dialog_table .sfx_options_dialog_option_action input[type=checkbox] {
  transform: scale(1.25);
}
.sfx_options_dialog_table .sfx_options_dialog_option_disabled {
  opacity: 0.7;
}
#sfx_options_dialog_actions {
  float: right;
}
/* Dialog Panels */
.sfx_panel {
  padding: 5px;
}
.sfx_panel_title_bar {
  padding: 0 3px;
  color: #4267B2;
  font-weight: bold;
  font-size: calc(0.7rem * var(--sfx_ui_scale));
  line-height: 18px;
  border-bottom: 1px solid #ccc;
  margin-bottom: 5px;
}
.sfx_options_dialog_panel {
  padding: 5px;
}
.sfx_options_dialog_panel > div:last-child {
  margin-top: 10px;
}
.sfx_options_dialog_panel .sfx_options_dialog_panel {
  background-color: #e7e9ef;
  margin: 10px 0;
}
.sfx_options_dialog_panel .sfx_options_dialog_panel .sfx_panel_title_bar {
  font-size: calc(0.9rem * var(--sfx_ui_scale));
}
.sfx_options_dialog_panel .sfx_options_dialog_panel_button {
  float: right;
  margin: 5px;
}
/* Filter Styles */
.sfx_options_dialog_filter_conditions,
.sfx_options_dialog_filter_actions {
  margin-top: 0;
}
.sfx_options_dialog_panel_header {
  font-weight: bold;
  margin: 30px 0 10px;
  color: #697688;
  font-size: calc(0.75rem * var(--sfx_ui_scale));
  background-color: #E9EBEE;
  padding: 10px;
}

.sfx_permalink_target [aria-expanded] .S2F_pos_abs {
  opacity: 1;
}
.__fb-dark-mode .sfx_permalink_target [aria-expanded] .S2F_pos_abs {
  filter: invert(100%) contrast(100%);
}

[sfx_photo_tags]:hover::after {
  content: attr(sfx_photo_tags);
  color: white;
  font-size: calc(0.7rem * var(--sfx_ui_scale));
  line-height: calc(0.9rem * var(--sfx_ui_scale));
  font-weight: bold;
  text-shadow: -1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000;
  position: absolute;
  bottom: 0;
  left: 0;
  background-color: #000000;
  border: 1px solid #999;
  margin: 5px;
  padding: 2px;
}

.sfx_filter_hidden:not(.sfx_filter_hidden_show) > *:not(.sfx_filter_hidden_note) {
  display: none !important;
}
.sfx_filter_hidden_note {
  padding: 0 5px;
  border: 1px dashed #333;
  font-size: calc(0.55rem * var(--sfx_ui_scale));
  opacity: 0.5;
  cursor: pointer;
  margin-top: 2px;
  color: var(--primary-text) !important;
}
.sfx_filter_hidden_note:hover {
  opacity: 1;
}
[sfx_post].sfx_filter_hidden_show .sfx_filter_hider_note {
  display: none;
}
[sfx_post]:not(.sfx_filter_hidden_show) .sfx_filter_hider_nyet {
  display: none;
}

#sfx_control_panel .sfx_filter_tab {
  cursor: pointer;
  padding: 2px 10px 2px 5px;
  background-color: #F6F7F9;
}
#sfx_control_panel .sfx_filter_tab:hover {
  background-color: #5890FF;
}
#sfx_control_panel .sfx_filter_tab:hover .sfx_count {
  color: black;
}
#sfx_control_panel .sfx_filter_tab.sfx_tab_selected {
  background-color: #4267B2;
  color: white;
}
#sfx_control_panel .sfx_filter_tab.sfx_tab_selected .sfx_count {
  color: white;
}
#sfx_control_panel .sfx_filter_tab.sfx_tab_occupied {
  font-weight: bold;
}
#sfx_control_panel .sfx_filter_tab:not(.sfx_tab_occupied):not(.sfx_tab_selected):not(:hover) {
  background-color: #d7dce5;
}
#sfx_control_panel .sfx_count {
  font-style: italic;
  color: #999;
}

.sfx_scroll_pause {
  display: none;
}
/*
 * Posts must be 'visible' during post ID lookup for the injected
 * pointer events to be processed.  This keeps them out of user's
 * sight, and avoids the worst of the page & scrollbar jitter.
 */
.sfx_touch {
  display: block !important;
  position: absolute;
  height: 111px;
  width: 111px;
  overflow: hidden;
  opacity: 0;
}

/* "Sticky" note */
.sfx_sticky_note {
  position: absolute;
  min-height: 14px;
  min-width: 150px;
  right: 100%;
  margin-right: 8px;
  top: 50%;
  font-family: arial;
  background-color: #FFFFE5;
  color: black;
  border: 1px solid #3F5C71;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  padding: 3px;
  text-align: center;
  border-radius: 6px;
  box-shadow: 0 0 5px #888888;
  z-index: 9999 !important;
}
.sfx_sticky_note_right {
  left: 100%;
  right: auto;
  margin-left: 8px;
  margin-right: auto;
}
.sfx_sticky_note_left {
  right: 100%;
  left: auto;
  margin-right: 8px;
  margin-left: auto;
}
.sfx_sticky_note_bottom {
  top: 200%;
  right: auto;
  left: -25%;
  margin-top: 8px;
  margin-right: 0;
  margin-left: -3px;
}
.sfx_sticky_note_top {
  top: -100%;
  right: auto;
  left: -25%;
  margin-bottom: 8px;
  margin-right: 0;
  margin-left: -3px;
}
.sfx_sticky_note_arrow_border {
  border-color: transparent transparent transparent #666666;
  border-style: solid;
  border-width: 7px;
  height: 0;
  width: 0;
  position: absolute;
  margin-top: -7px;
  top: 50%;
  right: -15px;
}
.sfx_sticky_note_right .sfx_sticky_note_arrow_border {
  border-color: transparent #666666 transparent transparent;
  top: 50%;
  right: auto;
  left: -15px;
}
.sfx_sticky_note_left .sfx_sticky_note_arrow_border {
  border-color: transparent transparent transparent #666666;
  top: 50%;
  right: -15px;
  left: auto;
}
.sfx_sticky_note_bottom .sfx_sticky_note_arrow_border {
  border-color: transparent transparent #666666 transparent;
  left: 50%;
  right: auto;
  top: -15px;
  margin-left: -7px;
  margin-top: 0;
}
.sfx_sticky_note_top .sfx_sticky_note_arrow_border {
  border-color: #666666 transparent transparent transparent;
  left: 50%;
  right: auto;
  top: auto;
  bottom: -15px;
  margin-left: -7px;
  margin-bottom: 0;
}
.sfx_sticky_note_arrow {
  border-color: transparent transparent transparent #ffa;
  border-style: solid;
  border-width: 7px;
  height: 0;
  width: 0;
  position: absolute;
  top: 50%;
  right: -13px;
  margin-top: -7px;
}
.sfx_sticky_note_right .sfx_sticky_note_arrow {
  border-color: transparent #ffa transparent transparent;
  top: 50%;
  right: auto;
  left: -13px;
}
.sfx_sticky_note_left .sfx_sticky_note_arrow {
  border-color: transparent transparent transparent #ffa;
  top: 50%;
  right: -13px;
  left: auto;
}
.sfx_sticky_note_bottom .sfx_sticky_note_arrow {
  border-color: transparent transparent #ffa transparent;
  left: 50%;
  right: auto;
  top: -13px;
  margin-left: -7px;
  margin-top: 0;
}
.sfx_sticky_note_top .sfx_sticky_note_arrow {
  border-color: #ffa transparent transparent transparent;
  left: 50%;
  right: auto;
  bottom: -13px;
  top: auto;
  margin-left: -7px;
  margin-bottom: 0;
}
.sfx_sticky_note_close {
  float: left;
  width: 9px;
  height: 9px;
  background-repeat: no-repeat;
  background-position: center center;
  cursor: pointer;
  background-image: url("data:image/gif,GIF89a%07%00%07%00%91%00%00%00%00%00%FF%FF%FF%9C%9A%9C%FF%FF%FF!%F9%04%01%00%00%03%00%2C%00%00%00%00%07%00%07%00%00%02%0C%94%86%A6%B3j%C8%5Er%F1%B83%0B%00%3B");
  border: 1px solid transparent;
  float: right;
}
div.sfx_sticky_note_close:hover {
  background-image: url("data:image/gif,GIF89a%07%00%07%00%91%00%00%00%00%00%FF%FF%FF%FF%FF%FF%00%00%00!%F9%04%01%00%00%02%00%2C%00%00%00%00%07%00%07%00%00%02%0C%04%84%A6%B2j%C8%5Er%F1%B83%0B%00%3B");
  border: 1px solid black;
}

.sfx_link {
  text-decoration: underline !important;
  cursor: pointer !important;
}
.sfx_hover_link:hover {
  text-decoration: underline !important;
  cursor: pointer !important;
}
.sfx_clearfix:after {
  clear: both;
  content: '.';
  display: block;
  font-size: 0;
  height: 0;
  line-height: 0;
  visibility: hidden;
}
.sfx_info_icon {
  content: "i";
  position: absolute;
  display: block;
  left: 6px;
  top: 6px;
  width: 20px;
  height: 20px;
  font-size: calc(0.9rem * var(--sfx_ui_scale));
  line-height: 18px;
  text-align: center;
  font-style: italic;
  vertical-align: middle;
  font-family: serif !important;
  font-weight: bold;
  background-color: #5890FF;
  color: white;
  padding: 0;
  border-radius: 20px;
}
.sfx_info {
  background-color: #FFFFE5;
  border: 1px solid #666;
  border-radius: 6px;
  padding: 7px;
  margin: 5px;
  font-family: arial;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  position: relative;
}
.sfx_info:not(.no_icon) {
  padding-left: 35px;
}
.sfx_info:not(.no_icon)::before {
  content: "i";
  position: absolute;
  display: block;
  left: 6px;
  top: 6px;
  width: 20px;
  height: 20px;
  font-size: calc(0.9rem * var(--sfx_ui_scale));
  line-height: 18px;
  text-align: center;
  font-style: italic;
  vertical-align: middle;
  font-family: serif !important;
  font-weight: bold;
  background-color: #5890FF;
  color: white;
  padding: 0;
  border-radius: 20px;
}
.sfx_highlight {
  background-color: yellow;
  color: black;
}
.sfx_label_value {
  display: table;
  width: 95%;
  margin: 3px;
}
.sfx_label_value > * {
  display: table-cell;
}
.sfx_label_value input.sfx_wide {
  width: 100%;
}
.sfx_label_value > *:first-child {
  font-weight: bold;
  padding-right: 10px;
  width: 1px;
}
.sfx_label_value > .stretch {
  width: 100%;
}
/* A "Help" icon with tooltip */
.sfx-help-icon:after {
  display: inline-block;
  height: 14px;
  width: 14px;
  vertical-align: middle;
  background-color: #7187B5;
  color: white;
  border-radius: 50%;
  content: "?";
  cursor: help;
  text-align: center;
  line-height: 12px;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  font-weight: bold;
  letter-spacing: normal;
}
/* FLEXBOX */
.sfx-flex-row,
.sfx-flex-column {
  display: flex;
}
.sfx-flex-row > *,
.sfx-flex-column > * {
  flex: auto;
  align-self: auto;
  overflow: auto;
}
.sfx-flex-row,
.sfx-flex-column {
  flex-wrap: nowrap;
  justify-content: flex-start;
  align-content: stretch;
  align-items: stretch;
}
.sfx-flex-row {
  flex-direction: row;
}
.sfx-flex-column {
  flex-direction: column;
}
.sfx-flex-row-container {
  display: flex;
  flex-flow: row wrap;
  justify-content: flex-start;
}
.sfx-flex-row-container > * {
  margin-right: 5px;
}
.sfx-flex-row-container > *:not(.stretch) {
  flex-shrink: 0 ;
}
.sfx-flex-row-container > .stretch {
  flex-grow: 1;
}
.sfx-flex-row-container > .stretch > .stretch {
  width: 100%;
}

.sfx_unread_errmsg {
  color: #f47;
}


.mark_read_filter {
    background: url('data:image/gif;base64,R0lGODdhEAAQAJAAALG1u////yH5BAEAAAEALAAAAAAQABAAAAIgjI8ZwO0Po1vyndoSVhRy431gJo5MaQJop6KTS5bv+hUAOw==');
}

.mark_read_markit {
    background: url('data:image/gif;base64,R0lGODdhEAAQAJAAALG1u////yH5BAEAAAEALAAAAAAQABAAAAIgjI+pC73Z3DMRTBpvqHrnyyGfJ4lZCFVoqoLrM7pWRxcAOw==');
}

.mark_read_nomark {
    background: url('data:image/gif;base64,R0lGODdhEAAQAJAAALG1u////yH5BAEAAAEALAAAAAAQABAAAAIijI+pC73Z3DMRTBpZ3Rbx/VSQFIijY55cuE7gVZJXBtdGAQA7');
}

.mark_read_wrench {
    background: url('data:image/gif;base64,R0lGODdhEAAQAPUAALq9wra5v/39/bO3vd7f4rS4vvn5+vf3+O7v8P7+/rW4vvz8/bW5v7W5vujp69/h5Nze4fz8/O/w8ezt7/Lz9M3Q1Ly/xbO2vOHj5cDDyPX19srN0e7u8L7BxszP0rS4vbq+w/Hx8re7wLK2vObn6dvd4NPV2MLFycXIzMnM0Pb298vN0bu/xPj4+fn5+dja3cbJzrG1u////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAADIALAAAAAAQABAAAAZyQJlwKEQ8iMihZhMzJZEkRSxgeA4Rg1isRExAkBWtYkEkBJAnrUgwPDBiSJY2tmLLUrECEjCPdV4wWgBECxd9hyhEGIeHBEMUAYxzGXYqfHMDIFkjHlUyLRZzHwQRQi4JRAeXDRNWQyEFARyuRA4StEJBADs=');
}
`;

const sfx_menu_style = `
/* Make room for the SFX Menu badge */
html[dir=ltr] [role=banner] > :last-child {
  right: 50px;
}
#sfx_badge {
  position: fixed;
  z-index: 350;
  cursor: pointer;
}
#sfx_badge .sfx_sticky_note {
  white-space: nowrap;
}
#sfx_badge:not(:hover)::after {
  opacity: 0.5;
}
#sfx_badge[sfx_notification_count="X"]::after {
  background-color: #b66;
}
#sfx_badge_logo {
  position: relative;
  z-index: 351;
  color: white;
  font-size: calc(0.45rem * var(--sfx_ui_scale));
  text-align: center;
  height: 30px;
  width: 30px;
  border-radius: 16px;
  opacity: 0.5;
  border: 2px solid transparent;
  box-shadow: 3px 3px 3px #1c1c1c;
  background: #2C4166 url(data:image/gif;base64,R0lGODlhFwAXAOYAAJOgv3%2BOr4KRsYWUtIiXt5GfvpmnxZimxJelw5mmxKCuzKCty6GuzKOwzaKvzKe00aWyz09hhFVnilZoi1lrjlxtkGh5mml6m2x9nmt8nW%2BAoW19nnGCo29%2FoHSEpXKCo3yMrH%2BPr4SUs4CProeWtYWUs4mYt4iXtoybuoqZuI6dvI2cupWkwpalwpakwZ2ryKCuy56syaGvzCxBZi1CZy5DaDFGazJHbDFFajNHbDVJbjZKbzhMcThMcDpOczpOcj1RdUBUeEBTd0JWekFVeERYe0VYfElcf1FkhlRniVhqjFxukGFzlGV3mHqLqjBFaTNIbDZLbzlOcv%2F%2F%2FwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAFMALAAAAAAXABcAAAe4gFMzg4SFhoeCh4Y9ShkeHUtSipNNLw%2BXlwxHk4YSmJcQAxQ7nIUlmAcbQ6WGOwuYH6yHEZ8JNrKFHJ8PE4Y1nDUFuyKDOUgCTJxFuw8NERgIlxecGsy7DUSTQArWnxWTNSTdmB7gTuOXATSKTyPMDiBJLA8mN4o4IbswG0CDFgY8FEER9wmFkEJR%2Bh3aQWDXCSi4fqzYlUIHrhkqdgGIcnGGjE8ufHScwQBVkJEzpsSI0cIIyimBAAA7) no-repeat center center;
}
#sfx_badge:hover #sfx_badge_logo {
  opacity: 1;
  border: 2px solid white;
  box-shadow: none;
}
#sfx_badge_menu {
  z-index: 350;
  display: none;
  position: absolute;
  background-color: transparent;
  color: black;
  width: 250px;
}
#sfx_badge_menu.left {
  right: 12px;
}
#sfx_badge_menu.right {
  left: 25px;
}
#sfx_badge_menu.down {
  top: 0;
}
#sfx_badge_menu.up {
  bottom: 15px;
}
#sfx_badge_menu.up #sfx_badge_menu_wrap {
  display: flex;
  flex-direction: column-reverse;
}
#sfx_badge_menu_wrap {
  background-color: white;
  border-radius: 4px;
  border-color: #ddd;
  padding: 10px;
  margin-top: 20px;
  box-shadow: 0 0 5px rgba(105, 118, 136, 0.2), 0 5px 5px rgba(132, 143, 160, 0.2), 0 10px 10px rgba(132, 143, 160, 0.2), 0 20px 20px rgba(132, 143, 160, 0.2), 0 0 5px rgba(105, 118, 136, 0.3);
}
.sfx_menu_section {
  margin-bottom: 10px;
}
.sfx_menu_section:last-child {
  margin-bottom: 0;
}
.sfx_menu_section .sfx_menu_section_title {
  color: #3B5998;
  font-size: calc(0.45rem * var(--sfx_ui_scale));
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid #bec4cd;
  padding: 0 5px;
}
.sfx_menu_section .sfx_menu_item {
  padding: 3px 5px 3px 15px;
  font-size: calc(0.6rem * var(--sfx_ui_scale));
}
.sfx_menu_section .sfx_menu_item .sfx_news_title {
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  color: #666;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 1px 5px;
}
.sfx_menu_section .sfx_menu_item:hover {
  background-color: #7187B5;
  color: white;
}
.sfx_menu_section .sfx_menu_item:hover .sfx_news_title {
  color: white;
}
.sfx_menu_section .sfx_menu_item a.sfx_menu_item_content {
  text-decoration: none;
  color: inherit;
}
#sfx_badge_menu_item_page {
  position: relative;
}

[sfx_notification_count]:not([sfx_notification_count='0'])::after {
  content: attr(sfx_notification_count);
  background-color: #F40008;
  color: white;
  position: absolute;
  display: inline-block;
  top: -3px;
  left: -3px;
  margin: 0 2px -1px 0;
  padding: 2px 1.5px 0;
  line-height: calc(0.7rem * var(--sfx_ui_scale));
  font-size: calc(0.6rem * var(--sfx_ui_scale));
  font-weight: bold;
  border: 1px solid #2C4166;
  border-radius: 3px;
  z-index: 352;
}
.sfx_menu_item span[sfx_notification_count]::after {
  position: static;
}

`;

try {
// Libraries
// ===========
var XLib = function( args ) {
	args = args || {};

	// LOCAL CHANGE to prevent errors in Chrome:
	// -  !t.isImmediatePropagationStopped()
	// +  (!t.isImmediatePropagationStopped || !t.isImmediatePropagationStopped())
	// http://github.e-sites.nl/zeptobuilder/
	/*! Zepto 1.2.0 (generated with Zepto Builder) - zepto event - zeptojs.com/license */
	//     Zepto.js
	//     (c) 2010-2016 Thomas Fuchs
	//     Zepto.js may be freely distributed under the MIT license.

	/* eslint-disable */
	var Zepto = (function() {
		var undefined, key, $, classList, emptyArray = [], concat = emptyArray.concat, filter = emptyArray.filter, slice = emptyArray.slice,
			document = window.document,
			elementDisplay = {}, classCache = {},
			cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
			fragmentRE = /^\s*<(\w+|!)[^>]*>/,
			singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
			tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
			rootNodeRE = /^(?:body|html)$/i,
			capitalRE = /([A-Z])/g,

			// special attributes that should be get/set via method calls
			methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

			adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
			table = document.createElement('table'),
			tableRow = document.createElement('tr'),
			containers = {
				'tr': document.createElement('tbody'),
				'tbody': table, 'thead': table, 'tfoot': table,
				'td': tableRow, 'th': tableRow,
				'*': document.createElement('div')
			},
			readyRE = /complete|loaded|interactive/,
			simpleSelectorRE = /^[\w-]*$/,
			class2type = {},
			toString = class2type.toString,
			zepto = {},
			camelize, uniq,
			uniques,
			tempParent = document.createElement('div'),
			propMap = {
				'tabindex': 'tabIndex',
				'readonly': 'readOnly',
				'for': 'htmlFor',
				'class': 'className',
				'maxlength': 'maxLength',
				'cellspacing': 'cellSpacing',
				'cellpadding': 'cellPadding',
				'rowspan': 'rowSpan',
				'colspan': 'colSpan',
				'usemap': 'useMap',
				'frameborder': 'frameBorder',
				'contenteditable': 'contentEditable'
			},
			isArray = Array.isArray ||
				function(object){ return object instanceof Array }
		zepto.mogrify = selector => (typeof selector === 'string' && typeof SFX === 'object' && typeof SFX.gib_convert === 'function') ? SFX.gib_convert(selector) : selector
		zepto.matches = function(element, selector) {
			if (!selector || !element || element.nodeType !== 1) return false
			var matchesSelector = element.matches || element.webkitMatchesSelector ||
				element.mozMatchesSelector || element.oMatchesSelector ||
				element.matchesSelector
			selector = zepto.mogrify(selector)
			if (matchesSelector) return matchesSelector.call(element, selector)
			// fall back to performing a selector:
			var match, parent = element.parentNode, temp = !parent
			if (temp) (parent = tempParent).appendChild(element)
			match = ~zepto.qsa(parent, selector).indexOf(element)
			temp && tempParent.removeChild(element)
			return match
		}

		function type(obj) {
			return obj == null ? String(obj) :
			class2type[toString.call(obj)] || "object"
		}

		function isFunction(value) { return type(value) == "function" }
		function isWindow(obj)     { return obj != null && obj == obj.window }
		function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
		function isObject(obj)     { return type(obj) == "object" }
		function isPlainObject(obj) {
			return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
		}

		function likeArray(obj) {
			var length = !!obj && 'length' in obj && obj.length,
				type = $.type(obj)

			return 'function' != type && !isWindow(obj) && (
					'array' == type || length === 0 ||
					(typeof length == 'number' && length > 0 && (length - 1) in obj)
				)
		}

		function compact(array) { return filter.call(array, function(item){ return item != null }) }
		function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
		camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
		function dasherize(str) {
			return str.replace(/::/g, '/')
				.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
				.replace(/([a-z\d])([A-Z])/g, '$1_$2')
				.replace(/_/g, '-')
				.toLowerCase()
		}
		// .uniq([1,2,3,1]) == [1,2,3] -- one instance of each value which appears
		uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }
		// .uniques([1,2,3,1]) == [2,3] -- only values which appear exactly once
		uniques = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx && array.indexOf(item, idx + 1) == -1}) }

		function classRE(name) {
			return name in classCache ?
				classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
		}

		function maybeAddPx(name, value) {
			return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
		}

		function defaultDisplay(nodeName) {
			var element, display
			if (!elementDisplay[nodeName]) {
				element = document.createElement(nodeName)
				document.body.appendChild(element)
				display = getComputedStyle(element, '').getPropertyValue("display")
				element.parentNode.removeChild(element)
				display == "none" && (display = "block")
				elementDisplay[nodeName] = display
			}
			return elementDisplay[nodeName]
		}

		function children(element) {
			return 'children' in element ?
				slice.call(element.children) :
				$.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
		}

		function Z(dom, selector) {
			var i, len = dom ? dom.length : 0
			for (i = 0; i < len; i++) this[i] = dom[i]
			this.length = len
			this.selector = selector || ''
		}

		// `$.zepto.fragment` takes a html string and an optional tag name
		// to generate DOM nodes from the given html string.
		// The generated DOM nodes are returned as an array.
		// This function can be overridden in plugins for example to make
		// it compatible with browsers that don't support the DOM fully.
		zepto.fragment = function(html, name, properties) {
			var dom, nodes, container

			// A special case optimization for a single tag
			if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

			if (!dom) {
				if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
				if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
				if (!(name in containers)) name = '*'

				container = containers[name]
				container.innerHTML = '' + html
				dom = $.each(slice.call(container.childNodes), function(){
					container.removeChild(this)
				})
			}

			if (isPlainObject(properties)) {
				nodes = $(dom)
				$.each(properties, function(key, value) {
					if (methodAttributes.indexOf(key) > -1) nodes[key](value)
					else nodes.attr(key, value)
				})
			}

			return dom
		}

		// `$.zepto.Z` swaps out the prototype of the given `dom` array
		// of nodes with `$.fn` and thus supplying all the Zepto functions
		// to the array. This method can be overridden in plugins.
		zepto.Z = function(dom, selector) {
			return new Z(dom, selector)
		}

		// `$.zepto.isZ` should return `true` if the given object is a Zepto
		// collection. This method can be overridden in plugins.
		zepto.isZ = function(object) {
			return object instanceof zepto.Z
		}

		// `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
		// takes a CSS selector and an optional context (and handles various
		// special cases).
		// This method can be overridden in plugins.
		zepto.init = function(selector, context) {
			var dom
			// If nothing given, return an empty Zepto collection
			if (!selector) return zepto.Z()
			// Optimize for string selectors
			else if (typeof selector == 'string') {
				selector = zepto.mogrify(selector)
				selector = selector.trim()
				// If it's a html fragment, create nodes from it
				// Note: In both Chrome 21 and Firefox 15, DOM error 12
				// is thrown if the fragment doesn't begin with <
				if (selector[0] == '<' && fragmentRE.test(selector))
					dom = zepto.fragment(selector, RegExp.$1, context), selector = null
				// If there's a context, create a collection on that context first, and select
				// nodes from there
				else if (context !== undefined) return $(context).find(selector)
				// If it's a CSS selector, use it to select nodes.
				else dom = zepto.qsa(document, selector)
			}
			// If a function is given, call it when the DOM is ready
			else if (isFunction(selector)) return $(document).ready(selector)
			// If a Zepto collection is given, just return it
			else if (zepto.isZ(selector)) return selector
			else {
				// normalize array if an array of nodes is given
				if (isArray(selector)) dom = compact(selector)
				// Wrap DOM nodes.
				else if (isObject(selector))
					dom = [selector], selector = null
				// If it's a html fragment, create nodes from it
				else if (fragmentRE.test(selector))
					dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
				// If there's a context, create a collection on that context first, and select
				// nodes from there
				else if (context !== undefined) return $(context).find(selector)
				// And last but no least, if it's a CSS selector, use it to select nodes.
				else dom = zepto.qsa(document, selector)
			}
			// create a new Zepto collection from the nodes found
			return zepto.Z(dom, selector)
		}

		// `$` will be the base `Zepto` object. When calling this
		// function just call `$.zepto.init, which makes the implementation
		// details of selecting nodes and creating Zepto collections
		// patchable in plugins.
		$ = function(selector, context){
			return zepto.init(selector, context)
		}

		function extend(target, source, deep) {
			for (key in source)
				if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
					if (isPlainObject(source[key]) && !isPlainObject(target[key]))
						target[key] = {}
					if (isArray(source[key]) && !isArray(target[key]))
						target[key] = []
					extend(target[key], source[key], deep)
				}
				else if (source[key] !== undefined) target[key] = source[key]
		}

		// Copy all but undefined properties from one or more
		// objects to the `target` object.
		$.extend = function(target){
			var deep, args = slice.call(arguments, 1)
			if (typeof target == 'boolean') {
				deep = target
				target = args.shift()
			}
			args.forEach(function(arg){ extend(target, arg, deep) })
			return target
		}

		// `$.zepto.qsa` is Zepto's CSS selector implementation which
		// uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
		// This method can be overridden in plugins.
		zepto.qsa = function(element, selector){
			selector = zepto.mogrify(selector)
			var found,
				maybeID = selector[0] == '#',
				maybeClass = !maybeID && selector[0] == '.',
				nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
				isSimple = simpleSelectorRE.test(nameOnly)
			return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById
				( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
				(element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
					slice.call(
						isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName
							maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
								element.getElementsByTagName(selector) : // Or a tag
							element.querySelectorAll(selector) // Or it's not simple, and we need to query all
					)
		}

		function filtered(nodes, selector) {
			return selector == null ? $(nodes) : $(nodes).filter(selector)
		}

		$.contains = document.documentElement && document.documentElement.contains ?
			function(parent, node) {
				return parent !== node && parent.contains(node)
			} :
			function(parent, node) {
				while (node && (node = node.parentNode))
					if (node === parent) return true
				return false
			}

		function funcArg(context, arg, idx, payload) {
			return isFunction(arg) ? arg.call(context, idx, payload) : arg
		}

		function setAttribute(node, name, value) {
			value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
		}

		// access className property while respecting SVGAnimatedString
		function className(node, value){
			var klass = node.className || '',
				svg   = klass && klass.baseVal !== undefined

			if (value === undefined) return svg ? klass.baseVal : klass
			svg ? (klass.baseVal = value) : (node.className = value)
		}

		// "true"  => true
		// "false" => false
		// "null"  => null
		// "42"    => 42
		// "42.5"  => 42.5
		// "08"    => "08"
		// JSON    => parse if valid
		// String  => self
		function deserializeValue(value) {
			try {
				return value ?
				value == "true" ||
				( value == "false" ? false :
					value == "null" ? null :
						+value + "" == value ? +value :
							/^[\[\{]/.test(value) ? $.parseJSON(value) :
								value )
					: value
			} catch(e) {
				return value
			}
		}

		$.type = type
		$.isFunction = isFunction
		$.isWindow = isWindow
		$.isArray = isArray
		$.isObject = isObject
		$.isPlainObject = isPlainObject

		$.isEmptyObject = function(obj) {
			var name
			for (name in obj) return false
			return true
		}

		$.isNumeric = function(val) {
			var num = Number(val), type = typeof val
			return val != null && type != 'boolean' &&
				(type != 'string' || val.length) &&
				!isNaN(num) && isFinite(num) || false
		}

		$.inArray = function(elem, array, i){
			return emptyArray.indexOf.call(array, elem, i)
		}

		$.camelCase = camelize
		$.dasherize = dasherize
		$.trim = function(str) {
			return str == null ? "" : String.prototype.trim.call(str)
		}

		// plugin compatibility
		$.uuid = 0
		$.support = { }
		$.expr = { }
		$.noop = function() {}

		$.map = function(elements, callback){
			var value, values = [], i, key
			if (likeArray(elements))
				for (i = 0; i < elements.length; i++) {
					value = callback(elements[i], i)
					if (value != null) values.push(value)
				}
			else
				for (key in elements) {
					value = callback(elements[key], key)
					if (value != null) values.push(value)
				}
			return flatten(values)
		}

		$.each = function(elements, callback){
			var i, key
			if (likeArray(elements)) {
				for (i = 0; i < elements.length; i++)
					if (callback.call(elements[i], i, elements[i]) === false) return elements
			} else {
				for (key in elements)
					if (callback.call(elements[key], key, elements[key]) === false) return elements
			}

			return elements
		}

		$.grep = function(elements, callback){
			return filter.call(elements, callback)
		}

		$.cssProp = function(element, property, computedStyle) {
			let value = element.style[camelize(property)]
			if (value === undefined || /^($|inherit|initial|unset|revert)/i.test(value)) {
				value = (computedStyle || getComputedStyle(element)).getPropertyValue(dasherize(property))
			}
			return value
		}

		if (window.JSON) $.parseJSON = JSON.parse

		// Populate the class2type map
		$.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
			class2type[ "[object " + name + "]" ] = name.toLowerCase()
		})

		// Define methods that will be available on all
		// Zepto collections
		$.fn = {
			constructor: zepto.Z,
			length: 0,

			// Because a collection acts like an array
			// copy over these useful array functions.
			forEach: emptyArray.forEach,
			reduce: emptyArray.reduce,
			push: emptyArray.push,
			sort: emptyArray.sort,
			splice: emptyArray.splice,
			indexOf: emptyArray.indexOf,
			concat: function(){
				var i, value, args = []
				for (i = 0; i < arguments.length; i++) {
					value = arguments[i]
					args[i] = zepto.isZ(value) ? value.toArray() : value
				}
				return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
			},

			// `map` and `slice` in the jQuery API work differently
			// from their array counterparts
			map: function(fn){
				return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
			},
			slice: function(){
				return $(slice.apply(this, arguments))
			},

			ready: function(callback){
				// need to check if document.body exists for IE as that browser reports
				// document ready when it hasn't yet created the body element
				if (readyRE.test(document.readyState) && document.body) callback($)
				else document.addEventListener('DOMContentLoaded', function(){ callback($) }, { capture: false, once: true })
				return this
			},
			get: function(idx){
				return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
			},
			toArray: function(){ return this.get() },
			size: function(){
				return this.length
			},
			remove: function(){
				return this.each(function(){
					if (this.parentNode != null)
						this.parentNode.removeChild(this)
				})
			},
			each: function(callback){
				emptyArray.every.call(this, function(el, idx){
					return callback.call(el, idx, el) !== false
				})
				return this
			},
			filter: function(selector){
				if (isFunction(selector)) return this.not(this.not(selector))
				return $(filter.call(this, function(element){
					return zepto.matches(element, selector)
				}))
			},
			add: function(selector,context){
				return $(uniq(this.concat($(selector,context))))
			},
			is: function(selector){
				return this.length > 0 && zepto.matches(this[0], selector)
			},
			not: function(selector){
				var nodes=[]
				if (isFunction(selector) && selector.call !== undefined)
					this.each(function(idx){
						if (!selector.call(this,idx)) nodes.push(this)
					})
				else {
					var excludes = typeof selector == 'string' ? this.filter(selector) :
						(likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
					this.forEach(function(el){
						if (excludes.indexOf(el) < 0) nodes.push(el)
					})
				}
				return $(nodes)
			},
			has: function(selector){
				return this.filter(function(){
					return isObject(selector) ?
						$.contains(this, selector) :
						$(this).find(selector).size()
				})
			},
			eq: function(idx){
				return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
			},
			first: function(){
				var el = this[0]
				return el && !isObject(el) ? el : $(el)
			},
			last: function(){
				var el = this[this.length - 1]
				return el && !isObject(el) ? el : $(el)
			},
			find: function(selector){
				var result, $this = this
				if (!selector) result = $()
				else if (typeof selector == 'object')
					result = $(selector).filter(function(){
						var node = this
						return emptyArray.some.call($this, function(parent){
							return $.contains(parent, node)
						})
					})
				else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
				else result = this.map(function(){ return zepto.qsa(this, selector) })
				return result
			},
			// find, including the root node(s)
			probe: function(selector){
				return this.filter(function(){return $(this).is(selector)})
				           .add(this.find(selector));
			},
			closest: function(selector, context){
				var nodes = [], collection = typeof selector == 'object' && $(selector)
				this.each(function(_, node){
					while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
						node = node !== context && !isDocument(node) && node.parentNode
					if (node && nodes.indexOf(node) < 0) nodes.push(node)
				})
				return $(nodes)
			},
			// closest, but not this node.  'close' would be totally misunderstood...
			nearby: function(selector, context){
				return this.parent().closest(selector, context);
			},
			parents: function(selector){
				var ancestors = [], nodes = this
				while (nodes.length > 0)
					nodes = $.map(nodes, function(node){
						if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
							ancestors.push(node)
							return node
						}
					})
				return filtered(ancestors, selector)
			},
			// parents, including this node
			lineage: function(selector){
				selector = (selector == undefined) ? '*' : selector;
				return this.filter(function(){return $(this).is(selector)})
				           .add(this.parents(selector));
			},
			parent: function(selector){
				return filtered(uniq(this.pluck('parentNode')), selector)
			},
			children: function(selector){
				return filtered(this.map(function(){ return children(this) }), selector)
			},
			contents: function() {
				return this.map(function() { return this.contentDocument || slice.call(this.childNodes) })
			},
			siblings: function(selector){
				return filtered(this.map(function(i, el){
					return filter.call(children(el.parentNode), function(child){ return child!==el })
				}), selector)
			},
			empty: function(){
				return this.each(function(){ this.innerHTML = '' })
			},
			// `pluck` is borrowed from Prototype.js
			pluck: function(property){
				return $.map(this, function(el){ return el[property] })
			},
			show: function(){
				return this.each(function(){
					this.style.display == "none" && (this.style.display = '')
					if (getComputedStyle(this, '').getPropertyValue("display") == "none")
						this.style.display = defaultDisplay(this.nodeName)
				})
			},
			replaceWith: function(newContent){
				return this.before(newContent).remove()
			},
			wrap: function(structure){
				var func = isFunction(structure)
				if (this[0] && !func)
					var dom   = $(structure).get(0),
						clone = dom.parentNode || this.length > 1

				return this.each(function(index){
					$(this).wrapAll(
						func ? structure.call(this, index) :
							clone ? dom.cloneNode(true) : dom
					)
				})
			},
			wrapAll: function(structure){
				if (this[0]) {
					$(this[0]).before(structure = $(structure))
					var children
					// drill down to the inmost element
					while ((children = structure.children()).length) structure = children.first()
					$(structure).append(this)
				}
				return this
			},
			wrapInner: function(structure){
				var func = isFunction(structure)
				return this.each(function(index){
					var self = $(this), contents = self.contents(),
						dom  = func ? structure.call(this, index) : structure
					contents.length ? contents.wrapAll(dom) : self.append(dom)
				})
			},
			unwrap: function(){
				this.parent().each(function(){
					$(this).replaceWith($(this).children())
				})
				return this
			},
			clone: function(){
				return this.map(function(){ return this.cloneNode(true) })
			},
			hide: function(){
				return this.css("display", "none")
			},
			toggle: function(setting){
				return this.each(function(){
					var el = $(this)
						;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
				})
			},
			prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
			next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
			html: function(html){
				return 0 in arguments ?
					this.each(function(idx){
						var originHtml = this.innerHTML
						$(this).empty().append( funcArg(this, html, idx, originHtml) )
					}) :
					(0 in this ? this[0].innerHTML : null)
			},
			text: function(text){
				return 0 in arguments ?
					this.each(function(idx){
						var newText = funcArg(this, text, idx, this.textContent)
						this.textContent = newText == null ? '' : ''+newText
					}) :
					(0 in this ? this.pluck('textContent').join("") : null)
			},
			attr: function(name, value){
				var result
				return (typeof name == 'string' && !(1 in arguments)) ?
					(0 in this && this[0].nodeType == 1 && (result = this[0].getAttribute(name)) != null ? result : undefined) :
					this.each(function(idx){
						if (this.nodeType !== 1) return
						if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
						else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
					})
			},
			removeAttr: function(name){
				return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
					setAttribute(this, attribute)
				}, this)})
			},
			prop: function(name, value){
				name = propMap[name] || name
				return (1 in arguments) ?
					this.each(function(idx){
						this[name] = funcArg(this, value, idx, this[name])
					}) :
					(this[0] && this[0][name])
			},
			removeProp: function(name){
				name = propMap[name] || name
				return this.each(function(){ delete this[name] })
			},
			data: function(name, value){
				var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

				var data = (1 in arguments) ?
					this.attr(attrName, value) :
					this.attr(attrName)

				return data !== null ? deserializeValue(data) : undefined
			},
			val: function(value){
				if (0 in arguments) {
					if (value == null) value = ""
					return this.each(function(idx){
						this.value = funcArg(this, value, idx, this.value)
					})
				} else {
					return this[0] && (this[0].multiple ?
							$(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
							this[0].value)
				}
			},
			offset: function(coordinates){
				if (coordinates) return this.each(function(index){
					var $this = $(this),
						coords = funcArg(this, coordinates, index, $this.offset()),
						parentOffset = $this.offsetParent().offset(),
						props = {
							top:  coords.top  - parentOffset.top,
							left: coords.left - parentOffset.left
						}

					if ($this.css('position') == 'static') props['position'] = 'relative'
					$this.css(props)
				})
				if (!this.length) return null
				if (document.documentElement !== this[0] && !$.contains(document.documentElement, this[0]))
					return {top: 0, left: 0}
				var obj = this[0].getBoundingClientRect()
				return {
					left: obj.left + window.pageXOffset,
					top: obj.top + window.pageYOffset,
					width: Math.round(obj.width),
					height: Math.round(obj.height)
				}
			},
			css: function(property, value){
				if (arguments.length < 2) {
					var element = this[0]
					if (!element) return
					if (typeof property == 'string') {
						return $.cssProp(element, property)
					} else if (isArray(property)) {
						var props = {}
						var computedStyle = getComputedStyle(element, '')
						$.each(property, function(_, prop){
							props[prop] = $.cssProp(element, prop, computedStyle)
						})
						return props
					}
				}

				var css = ''
				if (type(property) == 'string') {
					if (!value && value !== 0)
						this.each(function(){ this.style.removeProperty(dasherize(property)) })
					else
						css = dasherize(property) + ":" + maybeAddPx(property, value)
				} else {
					for (key in property)
						if (!property[key] && property[key] !== 0)
							this.each(function(){ this.style.removeProperty(dasherize(key)) })
						else
							css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
				}

				return this.each(function(){ this.style.cssText += ';' + css })
			},
			index: function(element){
				return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
			},
			hasClass: function(name){
				if (!name) return false
				return emptyArray.some.call(this, function(el){
					return this.test(className(el))
				}, classRE(name))
			},
			addClass: function(name){
				if (!name) return this
				return this.each(function(idx){
					if (!('className' in this)) return
					classList = []
					var cls = className(this), newName = funcArg(this, name, idx, cls)
					newName.split(/\s+/g).forEach(function(klass){
						if (!$(this).hasClass(klass)) classList.push(klass)
					}, this)
					classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
				})
			},
			removeClass: function(name){
				return this.each(function(idx){
					if (!('className' in this)) return
					if (name === undefined) return className(this, '')
					classList = className(this)
					funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
						classList = classList.replace(classRE(klass), " ")
					})
					className(this, classList.trim())
				})
			},
			toggleClass: function(name, when){
				if (!name) return this
				return this.each(function(idx){
					var $this = $(this), names = funcArg(this, name, idx, className(this))
					names.split(/\s+/g).forEach(function(klass){
						(when === undefined ? !$this.hasClass(klass) : when) ?
							$this.addClass(klass) : $this.removeClass(klass)
					})
				})
			},
			scrollTop: function(value){
				if (!this.length) return
				var hasScrollTop = 'scrollTop' in this[0]
				if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
				return this.each(hasScrollTop ?
					function(){ this.scrollTop = value } :
					function(){ this.scrollTo(this.scrollX, value) })
			},
			scrollLeft: function(value){
				if (!this.length) return
				var hasScrollLeft = 'scrollLeft' in this[0]
				if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
				return this.each(hasScrollLeft ?
					function(){ this.scrollLeft = value } :
					function(){ this.scrollTo(value, this.scrollY) })
			},
			position: function() {
				if (!this.length) return

				var elem = this[0],
					// Get *real* offsetParent
					offsetParent = this.offsetParent(),
					// Get correct offsets
					offset       = this.offset(),
					parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

				// Subtract element margins
				// note: when an element has margin: auto the offsetLeft and marginLeft
				// are the same in Safari causing offset.left to incorrectly be 0
				offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
				offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

				// Add offsetParent borders
				parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
				parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

				// Subtract the two offsets
				return {
					top:  offset.top  - parentOffset.top,
					left: offset.left - parentOffset.left
				}
			},
			offsetParent: function() {
				return this.map(function(){
					var parent = this.offsetParent || document.body
					while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
						parent = parent.offsetParent
					return parent
				})
			}
		}

		// for now
		$.fn.detach = $.fn.remove

		// Generate the `width` and `height` functions
		;['width', 'height'].forEach(function(dimension){
			var dimensionProperty =
				dimension.replace(/./, function(m){ return m[0].toUpperCase() })

			$.fn[dimension] = function(value){
				var offset, el = this[0]
				if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
					isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
					(offset = this.offset()) && offset[dimension]
				else return this.each(function(idx){
					el = $(this)
					el.css(dimension, funcArg(this, value, idx, el[dimension]()))
				})
			}
		})

		function traverseNode(node, fun) {
			fun(node)
			for (var i = 0, len = node.childNodes.length; i < len; i++)
				traverseNode(node.childNodes[i], fun)
		}

		// Generate the `after`, `prepend`, `before`, `append`,
		// `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
		adjacencyOperators.forEach(function(operator, operatorIndex) {
			var inside = operatorIndex % 2 //=> prepend, append

			$.fn[operator] = function(){
				// arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
				var argType, nodes = $.map(arguments, function(arg) {
						var arr = []
						argType = type(arg)
						if (argType == "array") {
							arg.forEach(function(el) {
								if (el.nodeType !== undefined) return arr.push(el)
								else if ($.zepto.isZ(el)) return (arr = arr.concat(el.get()))
								arr = arr.concat(zepto.fragment(el))
							})
							return arr
						}
						return argType == "object" || arg == null ?
							arg : zepto.fragment(arg)
					}),
					parent, copyByClone = this.length > 1
				if (nodes.length < 1) return this

				return this.each(function(_, target){
					parent = inside ? target : target.parentNode

					// convert all methods to a "before" operation
					target = operatorIndex == 0 ? target.nextSibling :
						operatorIndex == 1 ? target.firstChild :
							operatorIndex == 2 ? target :
								null

					var parentInDocument = $.contains(document.documentElement, parent)

					nodes.forEach(function(node){
						if (copyByClone) node = node.cloneNode(true)
						else if (!parent) return $(node).remove()

						parent.insertBefore(node, target)
						if (parentInDocument) traverseNode(node, function(el){
							if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
								(!el.type || el.type === 'text/javascript') && !el.src){
								var target = el.ownerDocument ? el.ownerDocument.defaultView : window
								target['eval'].call(target, el.innerHTML)
							}
						})
					})
				})
			}

			// after    => insertAfter
			// prepend  => prependTo
			// before   => insertBefore
			// append   => appendTo
			$.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
				$(html)[operator](this)
				return this
			}
		})

		zepto.Z.prototype = Z.prototype = $.fn

		// Export internal API functions in the `$.zepto` namespace
		zepto.uniq = uniq
		zepto.uniques = uniques
		zepto.deserializeValue = deserializeValue
		$.zepto = zepto

		return $
	})()

	// If `$` is not yet defined, point it to `Zepto`
	window.Zepto = Zepto
	window.$ === undefined && (window.$ = Zepto)
	//     Zepto.js
	//     (c) 2010-2016 Thomas Fuchs
	//     Zepto.js may be freely distributed under the MIT license.

	;(function($){
		var _zid = 1, undefined,
			slice = Array.prototype.slice,
			isFunction = $.isFunction,
			isString = function(obj){ return typeof obj == 'string' },
			handlers = {},
			specialEvents={},
			focusinSupported = 'onfocusin' in window,
			focus = { focus: 'focusin', blur: 'focusout' },
			hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

		specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

		function zid(element) {
			return element._zid || (element._zid = _zid++)
		}
		function findHandlers(element, event, fn, selector) {
			event = parse(event)
			if (event.ns) var matcher = matcherFor(event.ns)
			return (handlers[zid(element)] || []).filter(function(handler) {
				return handler
					&& (!event.e  || handler.e == event.e)
					&& (!event.ns || matcher.test(handler.ns))
					&& (!fn       || zid(handler.fn) === zid(fn))
					&& (!selector || handler.sel == selector)
			})
		}
		function parse(event) {
			var parts = ('' + event).split('.')
			return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
		}
		function matcherFor(ns) {
			return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
		}

		function eventCapture(handler, captureSetting) {
			return handler.del &&
				(!focusinSupported && (handler.e in focus)) ||
				!!captureSetting
		}

		function realEvent(type) {
			return hover[type] || (focusinSupported && focus[type]) || type
		}

		function add(element, events, fn, data, selector, delegator, capture){
			var id = zid(element), set = (handlers[id] || (handlers[id] = []))
			events.split(/\s/).forEach(function(event){
				if (event == 'ready') return $(document).ready(fn)
				var handler   = parse(event)
				handler.fn    = fn
				handler.sel   = selector
				// emulate mouseenter, mouseleave
				if (handler.e in hover) fn = function(e){
					var related = e.relatedTarget
					if (!related || (related !== this && !$.contains(this, related)))
						return handler.fn.apply(this, arguments)
				}
				handler.del   = delegator
				var callback  = delegator || fn
				handler.proxy = function(e){
					e = compatible(e)
					if (e.isImmediatePropagationStopped && e.isImmediatePropagationStopped()) return
					e.data = data
					var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
					if (result === false) e.preventDefault(), e.stopPropagation()
					return result
				}
				handler.i = set.length
				set.push(handler)
				if ('addEventListener' in element)
					element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
			})
		}
		function remove(element, events, fn, selector, capture){
			var id = zid(element)
				;(events || '').split(/\s/).forEach(function(event){
				findHandlers(element, event, fn, selector).forEach(function(handler){
					delete handlers[id][handler.i]
					if ('removeEventListener' in element)
						element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
				})
			})
		}

		$.event = { add: add, remove: remove }

		$.proxy = function(fn, context) {
			var args = (2 in arguments) && slice.call(arguments, 2)
			if (isFunction(fn)) {
				var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
				proxyFn._zid = zid(fn)
				return proxyFn
			} else if (isString(context)) {
				if (args) {
					args.unshift(fn[context], fn)
					return $.proxy.apply(null, args)
				} else {
					return $.proxy(fn[context], fn)
				}
			} else {
				throw new TypeError("expected function")
			}
		}

		$.fn.bind = function(event, data, callback){
			return this.on(event, data, callback)
		}
		$.fn.unbind = function(event, callback){
			return this.off(event, callback)
		}
		$.fn.one = function(event, selector, data, callback){
			return this.on(event, selector, data, callback, 1)
		}

		var returnTrue = function(){return true},
			returnFalse = function(){return false},
			ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
			eventMethods = {
				preventDefault: 'isDefaultPrevented',
				stopImmediatePropagation: 'isImmediatePropagationStopped',
				stopPropagation: 'isPropagationStopped'
			}

		function compatible(event, source) {
			if (source || !event.isDefaultPrevented) {
				source || (source = event)

				$.each(eventMethods, function(name, predicate) {
					var sourceMethod = source[name]
					event[name] = function(){
						this[predicate] = returnTrue
						return sourceMethod && sourceMethod.apply(source, arguments)
					}
					event[predicate] = returnFalse
				})

				event.timeStamp || (event.timeStamp = Date.now())

				if (source.defaultPrevented !== undefined ? source.defaultPrevented :
						'returnValue' in source ? source.returnValue === false :
						source.getPreventDefault && source.getPreventDefault())
					event.isDefaultPrevented = returnTrue
			}
			return event
		}

		function createProxy(event) {
			var key, proxy = { originalEvent: event }
			for (key in event)
				if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

			return compatible(proxy, event)
		}

		$.fn.delegate = function(selector, event, callback){
			return this.on(event, selector, callback)
		}
		$.fn.undelegate = function(selector, event, callback){
			return this.off(event, selector, callback)
		}

		$.fn.live = function(event, callback){
			$(document.body).delegate(this.selector, event, callback)
			return this
		}
		$.fn.die = function(event, callback){
			$(document.body).undelegate(this.selector, event, callback)
			return this
		}

		$.fn.on = function(event, selector, data, callback, one){
			var autoRemove, delegator, $this = this
			if (event && !isString(event)) {
				$.each(event, function(type, fn){
					$this.on(type, selector, data, fn, one)
				})
				return $this
			}

			if (!isString(selector) && !isFunction(callback) && callback !== false)
				callback = data, data = selector, selector = undefined
			if (callback === undefined || data === false)
				callback = data, data = undefined

			if (callback === false) callback = returnFalse

			return $this.each(function(_, element){
				if (one) autoRemove = function(e){
					remove(element, e.type, callback)
					return callback.apply(this, arguments)
				}

				if (selector) delegator = function(e){
					var evt, match = $(e.target).closest(selector, element).get(0)
					if (match && match !== element) {
						evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
						return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
					}
				}

				add(element, event, callback, data, selector, delegator || autoRemove)
			})
		}
		$.fn.off = function(event, selector, callback){
			var $this = this
			if (event && !isString(event)) {
				$.each(event, function(type, fn){
					$this.off(type, selector, fn)
				})
				return $this
			}

			if (!isString(selector) && !isFunction(callback) && callback !== false)
				callback = selector, selector = undefined

			if (callback === false) callback = returnFalse

			return $this.each(function(){
				remove(this, event, callback, selector)
			})
		}

		$.fn.trigger = function(event, args){
			event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
			event._args = args
			return this.each(function(){
				// handle focus(), blur() by calling them directly
				if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
				// items in the collection might not be DOM elements
				else if ('dispatchEvent' in this) this.dispatchEvent(event)
				else $(this).triggerHandler(event, args)
			})
		}

		// triggers event handlers on current element just as if an event occurred,
		// doesn't trigger an actual event, doesn't bubble
		$.fn.triggerHandler = function(event, args){
			var e, result
			this.each(function(i, element){
				e = createProxy(isString(event) ? $.Event(event) : event)
				e._args = args
				e.target = element
				$.each(findHandlers(element, event.type || event), function(i, handler){
					result = handler.proxy(e)
					if (e.isImmediatePropagationStopped && e.isImmediatePropagationStopped()) return false
				})
			})
			return result
		}

		// shortcut methods for `.bind(event, fn)` for each event type
		;('focusin focusout focus blur load resize scroll unload click dblclick '+
		'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
		'pointerdown pointerup pointermove pointerover pointerout pointerenter pointerleave '+
		'change select keydown keypress keyup error').split(' ').forEach(function(event) {
			$.fn[event] = function(callback) {
				return (0 in arguments) ?
					this.bind(event, callback) :
					this.trigger(event)
			}
		})

		$.Event = function(type, props) {
			if (!isString(type)) props = type, type = props.type
			var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
			if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
			event.initEvent(type, bubbles, true)
			return compatible(event)
		}

	})(Zepto)
	/* eslint-enable */

	var x = Zepto;

	(function() {
		var counters={};
		x.call_counter = function(funcname, args) {
			args = args || "";
			var id = funcname+"("+args+")";
			counters[id] = (counters[id]||0) + 1;
			if (counters[id]%50===0) {
				x.log("X Calls ["+counters[id]+": "+id);
			}
		}
	})();

		// Zepto extensions
	x.fn.innerText = function(nodeFilter_obj, joiner) {
		if (!(0 in this)) { return null; }
		joiner = (typeof joiner == 'string') ? joiner : ' ';
		return x.map(this, function(el) {
			var node, text = [];
			var whatToShow = nodeFilter_obj ? NodeFilter.SHOW_ALL : NodeFilter.SHOW_TEXT;
			var walker = document.createTreeWalker(el, whatToShow, nodeFilter_obj, false);
			while ((node = walker.nextNode())) {
				text.push(node.nodeValue);
			}
			return text.join(joiner);
		}).join(joiner).replace(/\n+/g, joiner);
	};
	// Get the text content of only this node, not child nodes
	x.fn.shallowText = function(joiner) {
		if (!(0 in this)) { return null; }
		joiner = (typeof joiner == 'string') ? joiner : ' ';
		return x.map(this, function(el) {
			if (!el.childNodes) { return ''; }
			var text = [], children=el.childNodes;
			for (var i=0; i<children.length; i++) {
				var child = children[i];
				if (3===child.nodeType) {
					text.push(child.nodeValue);
				}
			}
			return text.join(joiner);
		}).join(joiner).replace(/\n+/g, joiner);
	};
	// web-ext: x.fn is not a DOM node; this is creating a member function for class 'Z'
	x.fn.outerHTML = function() {
		if (!(0 in this)) { return null; }
		return x('<div>').append(this[0].cloneNode(true)).html();
	};
	x.fn.tagHTML = function() {
		return x('<div>').append(this[0].cloneNode(false)).html().replace(/>.*/,'>');
	};
	x.fn.select = function(copy) {
		if (!(0 in this)) { return null; }
		var el = this[0];
		if (window.getSelection && document.createRange) { //Browser compatibility
			var s = window.getSelection();
			setTimeout(function(){
				var r = document.createRange();
				r.selectNodeContents(el);
				s.removeAllRanges();
				s.addRange(r);
				if (copy) {
					x.clipboard.copy();
				}
			},1);
		}
	};
	// Is the last direct child of this element visible?  Call on direct parent of
	// a dynamically growing list of elements.
	x.fn.isScrolledToBottom = function() {
		const $last_line = this.find('* > :not(:empty):last-of-type');
		if (!$last_line.length) return false;
		const llr = $last_line[0].getBoundingClientRect();
		return $last_line[0].contains(document.elementFromPoint(llr.left, llr.top));
	};
	// Make the last direct child element of a list visible by scrolling to the bottom.
	x.fn.scrollToBottom = function() {
		const $last_line = this.find('* > :not(:empty):last-of-type');
		$last_line.length && $last_line[0].scrollIntoView(false);
	};
	// Append to a scrolling element, then scroll downwards if the element was
	// already scrolled to bottom.  This allows a dynamically scrolling status
	// window which cooperates when the user wants to scroll backwards.
	x.fn.scrollingAppend = function(...appends) {
		var scrollIt = this.isScrolledToBottom();
		this.append(...appends);
		if (scrollIt) this.scrollToBottom();
	};

	// Are we running in the page context or extension context?
	x.pagecontext = args.pagecontext || false;

	// Set an attribute on an Object using a possible deeply-nested path
	// Stole this from lodash _.set(object, path, value)
	// eslint-disable-next-line
	x.set=(function(){var h='[object Array]',g='[object Function]',p='[object String]';var k=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,m=/^\w*$/,l=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\n\\]|\\.)*?)\2)\]/g;var o=/\\(\\)?/g;var q=/^\d+$/;function n(b){return b==null?'':(b+'')}function f(b){return!!b&&typeof b=='object'}var j=Object.prototype;var b=j.toString;var d=9007199254740991;function r(b,c){b=(typeof b=='number'||q.test(b))?+b:-1;c=c==null?d:c;return b>-1&&b%1==0&&b<c}function t(b,d){var c=typeof b;if((c=='string'&&m.test(b))||c=='number'){return true}if(e(b)){return false}var f=!k.test(b);return f||(d!=null&&b in i(d))}function v(b){return typeof b=='number'&&b>-1&&b%1==0&&b<=d}function i(b){return c(b)?b:Object(b)}function s(b){if(e(b)){return b}var c=[];n(b).replace(l,function(d,b,f,e){c.push(f?e.replace(o,'$1'):(b||d))});return c}var e=function(c){return f(c)&&v(c.length)&&b.call(c)==h};function w(d){return c(d)&&b.call(d)==g}function c(c){var b=typeof c;return!!c&&(b=='object'||b=='function')}function x(c){return typeof c=='string'||(f(c)&&b.call(c)==p)}function u(e,d,k){if(e==null){return e}var i=(d+'');d=(e[i]!=null||t(d,e))?[i]:s(d);var f=-1,h=d.length,j=h-1,b=e;while(b!=null&&++f<h){var g=d[f];if(c(b)){if(f==j){b[g]=k}else if(b[g]==null){b[g]=r(d[f+1])?[]:{}}}b=b[g]}return e}return u})();

	// Test if a property is defined.
	x.def=function(o) {
		return typeof o!="undefined";
	};

	// Simple Pub/Sub
	x.pubsub_handlers = {};
	x.pubsub_messages = {}; // A list of all messages
	x.pubsub_persists = {};
	x.publish = function(event, data) {
		// if (typeof republish!="boolean") { republish=true; }
		data = data || {};
		(x.pubsub_handlers[event] || []).forEach(function(f) {
			try {
				f.call(x,event,data);
			} catch(e) {
				console.log(`X.publish: ${e} when calling:`,{f},`( '${event}',`, data, ')',
				            { stack: e.stack.split('\n') });
			}
		});
		// If we are running in the page context, send a message back to the extension code
		// if (republish) {
		//	// Clone data before posting, to make sure that object references are not passed
		//	try {
		//		// If the data has refs to React elements, circular refs will cause this to fail. Ignore it.
		//		window.postMessage( {"sfx":true, "pagecontext":x.pagecontext, "message": { "event":event, "data":x.clone(data) } } , "*");
		//	}
		//	catch(e) { }
		// }
		// Store messages in case a subscriber later wants the backlog.  When
		// 1st subscriber appears, backlog will be discarded if they don't want
		// it; or delivered and retained if they do, as additional subscribers
		// are expected to have the same backlog preference.
		if (!(event in x.pubsub_persists) || x.pubsub_persists[event]) {
			x.pubsub_messages[event] || (x.pubsub_messages[event] = []);
			x.pubsub_messages[event].push({event, data});
		}
	};
	x.pubsub_clear_backlog = function(event) {
		delete x.pubsub_messages[event];
	};
	// TODO: Wildcard subscriptions?
	x.subscribe_internal = function(event, func, receive_past_messages) {
		var events = (typeof event=="string") ? [event] : event;
		events.forEach(function(ev) {
			if (typeof x.pubsub_handlers[ev]=="undefined") {
				x.pubsub_handlers[ev]=[];
			}
			x.pubsub_handlers[ev].push(func);
			if (!(ev in x.pubsub_persists)) {
				x.pubsub_persists[ev] = receive_past_messages;
				if (!receive_past_messages) {
					x.pubsub_clear_backlog(ev);
				}
			} else if (x.pubsub_persists[ev] != receive_past_messages) {
				console.log(`X.subscribe: subscribers to '${ev}' disagree about persistence!`);
			}
			// If past messages are requested, fire this function for each of the past messages
			if (receive_past_messages) {
				(x.pubsub_messages[ev] || []).forEach(function(msg) {
					func.call(x,msg.event,msg.data);
				});
			}
		});
	};
	x.subscribe = function(event, func) {
		x.subscribe_internal(event, func, false);
	};
	x.subscribe_backlog = function(event, func) {
		x.subscribe_internal(event, func, true);
	};
	x.unsubscribe = function(func) {
		Object.values(x.pubsub_handlers).forEach(handlers =>
			handlers.forEach((handler, idx) =>
				handler == func && delete handlers[idx]))
	};
	x.subscribe_once = function(event, func) {
		x.unsubscribe(func);
		x.subscribe(event, func);
	};
	// Allow for passing of messages between extension and page contexts, using window.postMessage
	window.addEventListener('message', function(event) {
		if (event.data.sfx && event.data.pagecontext != x.pagecontext &&
		    (event.source == window || event.source == window.unsafeWindow) &&
		    event.origin == location.origin) {
			// A message has been received from the other context
			x.publish(event.data.message.event, event.data.message.data, false);
		}
	});

	// A Generalized storage/persistence mechanism
	var ls = window.localStorage;
	x.storage = {
		"prefix":null,
		"data":{}, // keys are options, stats, etc
		"set":function(key,prop,val,callback,save) {
			// update stored value in memory
			if (typeof x.storage.data[key]=="undefined") {
				x.storage.data[key] = {};
			}
			var container = x.storage.data[key];
			// Single value set
			if (typeof prop!="object" && (typeof callback=="undefined"||typeof callback=="function"||callback==null)) {
				x.storage.set_or_delete(container,prop,val);
			}
			// Multiset
			else if (typeof prop=="object" && (typeof val=="undefined"||typeof val=="function")) {
				save=callback;
				callback = val;
				var prop2;
				for (prop2 in prop) {
					x.storage.set_or_delete(container,prop2,prop[prop2]);
				}
			}
			else {
			}
			if (false!==save) {
				x.storage.save(key, null, callback);
			}
			else if (typeof callback=="function") {
				callback(key,null);
			}
		},
		"set_or_delete":function(container,prop,val) {
			// Delete a value by setting it to undefined
			if (prop in container && typeof val=="undefined") {
				delete container[prop];
			}
			else {
				x.set(container, prop, val);
			}
		},
		"save":function(key,val,callback) {
			if (val==null && typeof x.storage.data[key]!="undefined") {
				val = x.storage.data[key];
			}
			else {
				x.storage.data[key] = val;
			}
			// persist
			Extension.storage.set(key, val, function (key, val, ret) {
				// post to localstorage to trigger updates in other windows
				var o = {"time": x.now(), "key": key};
				ls.setItem('x-storage', JSON.stringify(o));
				// Call the callback
				if (typeof callback == "function") {
					callback(key, val, ret);
				}
			}, (x.storage.prefix != null ? x.storage.prefix + '/' : ''));
		},
		"get":function(keys, defaultValue, callback, use_cache) {
			if (!!use_cache && typeof keys=="string" && typeof x.storage.data[keys]!="undefined") {
				if (typeof callback=="function") { return callback(x.storage.data[keys]); }
			}
			// TODO: Get multi values from cache!
			Extension.storage.get(keys, defaultValue, function(values,err) {
				var key, i;
				if (!err) {
					// Store the data in memory
					if (typeof keys == "string") {
						// Single value
						if (typeof x.storage.data[keys] == "undefined") {
							x.storage.update(keys, values);
						}
					} else {
						// Multi value
						for (i = 0; i < keys.length; i++) {
							key = keys[i];
							x.storage.update(key, values[key]);
						}
					}
				}
				if (typeof callback=="function") {
					callback(values,err);
				}
			}, (x.storage.prefix!=null?x.storage.prefix+'/':'') );
		},
		"refresh":function(key,callback) {
			if (typeof x.storage.data[key]!="undefined") {
				x.storage.get(key, null, callback, false);
			}
		}
		,"update":function(key,value) {
			x.storage.data[key] = value;
		}
	};
	// Use localStorage to communicate storage changes between windows and tabs.
	// Changes to localStorage trigger the 'storage' event in other windows on the same site.
	if (!x.pagecontext) {
		window.addEventListener('storage', function (e) {
			if ("x-storage"==e.key && e.newValue) {
				var json;
				try {
					json = JSON.parse(e.newValue); // {"time":123,"key":"key_name"}
					if (json.key) {
						x.storage.refresh(json.key, function(data) {
							// Publish a message
							x.publish("storage/refresh", {"key":json.key,"data":data});
						});
					}
				} catch(err) {
					console.log('storage event',e,'error',err,'json',json);
				}
			}
		},true);
	}

	// Sanitize HTML using the DOMPurify library, if available
	x.sanitize = function(html) {
		return (typeof DOMPurify!="undefined" ? DOMPurify.sanitize(html) : html);
	};
	x.fn.safe_html = function(html) {
		html = x.sanitize(html);
		return this.each(function(){ x(this).html(html); });
	};


	// http/ajax
	x.ajax = function(urlOrObject,callback) {
		// TODO: Allow for ajax from pagecontext
		Extension.ajax(urlOrObject,function(content,status,headers) {
			if (headers && /application\/json/.test(headers['content-type'])) {
				content = JSON.parse(content);
			}
			callback(content,status);
		});
	};

	x.ajax_dom = function(urlOrObject, callback) {
		x.ajax(urlOrObject, function(data) {
			var $dom = x('<div>');
			try {
				$dom.append(data);
			}
			catch(e) {}
			callback($dom);
		});
	};

	// css
	x.css = function(css,id) {
		x.when('head',function($head) {
			css = x.zepto.mogrify(css);
			var s;
			if (id) {
				s = document.getElementById(id);
				if (s) {
					if (css) {
						s.textContent = css;
					} else {
						x(s).remove();
					}
					return;
				}
			}
			s = document.createElement('style');
			s.textContent = css;
			if (id) {
				s.id=id;
			}
			$head.append(s);
		});
	};

	// function execution in a <script> block (in page context)
	x.inject = function(code,args,windowVar) {
		if (!document || !document.createElement || !document.documentElement || !document.documentElement.appendChild) { return false; }
		var s = document.createElement('script');
		s.type = 'text/javascript';
		args = JSON.stringify(args||{});
		var result = windowVar?'window.'+windowVar+'=':'';
		code = result+'('+code.toString()+')('+args+');';
		if (windowVar) {
			// Post a window notification saying this variable is now defined
			code += 'window.postMessage({"sfxready":"'+windowVar+'"} , "*");';
		}
		s.text = code;
		document.documentElement.appendChild(s);
		s.parentNode.removeChild(s);
		return true;
	};

	// POLLING
	// Call a function repeatedly until it doesn't throw an exception or returns non-false
	x.poll = function(func,interval,max){
		x.call_counter("poll",func.toString().substring(10));
		interval=interval||500;
		max=max||50;
		var count=0;
		var f=function(){
			if(count++>max){return;}
			try{
				if (func(count)===false){
					setTimeout(f,interval);
				}
			}
			catch(e){
				setTimeout(f,interval);
			}
		};
		f();
	};
	// A function that executes a function only when a selector returns a result
	x.when = function(selector, func, interval, max) {
		// Keep default from previous implementation, but now allow for limits
		interval = interval || 200;
		max = max || 999999999;
		x.poll(function() {
			x.call_counter("when", selector);
			var $results = x(selector);
			if ($results.length > 0) {
				func($results);
			} else {
				return false;
			}
		},interval,max);
	};

	// Cookies
	x.cookie = {
		'get':function(n) {
			try {
				return unescape(document.cookie.match('(^|;)?'+n+'=([^;]*)(;|$)')[2]);
			} catch(e) {
				return null;
			}
		},
		'set':function() {}
	};

	// Logging
	x.logs = [];
	x.log = function(){
		if (arguments && arguments.length>0) {
			// Default meta-data
			var data = {"module":null, "color":"black"};
			var i=0;
			var info = arguments[0];
			var args = [];
			if (typeof info=="object" && info!=null && (info.module||info.color)) {
				// Meta-data about the logging
				i=1;
				data.module = info.module || data.module;
				data.level = info.level || data.level;
				data.color = info.color || data.color;
			}
			for (; i < arguments.length; i++) {
				if (typeof arguments[i] == "object") {
					args.push(JSON.stringify(arguments[i], null, 3));
				}
				else if (typeof arguments[i]!="undefined") {
					args.push(arguments[i]);
				}
			}
			data.log = args;
			data.timestamp = (new Date()).getTime();
			data.uptime = performance.now();
			x.logs.push(data);
			x.publish("log/entry",data,false,false);
		}
	};
	// Get a module-specific logger for use in modules
	x.logger = function(label,props) {
		var info = props || {};
		info.module = label;
		return function(a,b,c,d,e,f,g) {
			x.log.call(x,info,a,b,c,d,e,f,g);
		}
	};
	x.alert = function(msg) {
		if (typeof msg=="object") { msg=JSON.stringify(msg,null,3); }
		alert(msg);
	};

	// A "bind" function to support event capture mode
	x.bind = function(el, ev, func, capture) {
		if (typeof capture != "boolean") {
			capture = false;
		}
		el = x(el)[0];
		if (el && el.addEventListener) {
			el.addEventListener(ev, func, capture);
		}
		return el;
	};
	x.capture = function(el,ev,func) {
		return x.bind(el,ev,func,true);
	};
	x.unbind = function(el, ev, func, capture) {
		if (typeof capture != "boolean") {
			capture = false;
		}
		el = x(el)[0];
		if (el && el.removeEventListener) {
			el.removeEventListener(ev, func, capture);
		}
		return null;
	};
	x.uncapture = function(el,ev,func) {
		return x.unbind(el, ev, func, true);
	};

	// A backwards-compatible replacement for the old QSA() function
	x.QSA = function(context,selector,func) {
		if (typeof selector=="function") {
			func=selector;
			selector=context;
			context=document;
		}
		x(selector,context).each(function() {
			func(this);
		});
	};

	// A util method to find a single element matching a selector
	x.find = function(selector) {
		var o = x(selector);
		return (o.length>0) ? o[0] : null;
	};

	// Find the real target of an event
	x.target = function(e,wrap){ var t=e.target; if (t.nodeType == 3){t=t.parentNode;} return wrap?x(t):t; };
	x.parent = function(el){ if(el&&el.parentNode) { return el.parentNode; } return null; };

	// A util method to clone a simple object
	x.clone = function(o) { if (!o) { return o; } return JSON.parse(JSON.stringify(o)); };

	// Some useful string methods
	x.match = function (str, regex, func) {
		if (typeof str != "string") {
			return null;
		}
		var m = str.match(regex);
		if (m && m.length) {
			if (typeof func == "function") {
				for (var i = regex.global ? 0 : 1; i < m.length; i++) {
					func(m[i]);
				}
				return m;
			} else {
				return m.length > 1 ? m[regex.global ? 0 : 1] : null;
			}
		}
		return null;
	};
	// Convert string to form suitable for display as HTML, without HTML semantic meaning
	x.htmlEncode = function(html) {
		const parent = document.createElement('span');
		parent.appendChild(document.createTextNode(html));
		return parent.innerHTML;
	};

	// Get a timestamp
	x.time = function() { return Date.now(); };
	x.now = x.time;
	x.today = function() {
		var d = new Date();
		return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
	};
	// Express a timestamp as a relative time "ago"
	x.ago = function(when, now, shortened, higher_resolution) {
		now = now || x.now();
		if (typeof shortened!="boolean") { shortened=true; }
		var diff = "";
		var delta = (now - when);
		var seconds = delta / x.seconds;
		if (seconds < 60) {
			return "just now";
		}
		var days = Math.floor(delta / x.days);
		if (days > 0) {
			diff += days+" day"+(days>1?"s":"")+" ";
			delta -= (days*x.days);
		}

		var hours = Math.floor(delta / x.hours );
		if (hours>0 && (higher_resolution || !diff)) {
			diff += hours + " " + (shortened ? "hr" : "hours")+" ";
			delta -= (hours*x.hours);
		}

		var minutes = Math.floor(delta / x.minutes);
		if (minutes>0 && (!diff || (higher_resolution && days<1))) {
			diff += minutes + " " + (shortened ? "mins" : "minutes") + " ";
		}
		if (!diff) {
			diff = "a while ";
		}
		return diff+"ago";
	};

	// Recurring tasks execute only at certain intervals
	x.seconds = 1000;
	x.minutes = x.seconds * 60;
	x.hours = x.minutes * 60;
	x.days = x.hours * 24;
	x.task = function(key, frequency, callback, elsecallback) {
		// Internally store the state of each task in a user pref
		x.storage.get('tasks',{},function(tasks) {
			if (typeof tasks[key]=="undefined") {
				tasks[key] = {"run_on": null};
			}
			var t = tasks[key];
			var now = x.now();
			// If we are past due, update the task and execute the callback
			if (!t.run_on || ((t.run_on+frequency) < now)) {
				t.run_on = now;
				x.storage.set('tasks',key, t, function() {
					callback();
				});
			}
			else if (typeof elsecallback=="function") {
				elsecallback(t.run_on);
			}
		},true);
	};

	// Semver Compare
	x.semver_compare = function (a, b) {
		var pa = a.split('.');
		var pb = b.split('.');
		for (var i = 0; i < 3; i++) {
			var na = Number(pa[i]);
			var nb = Number(pb[i]);
			if (na > nb) return 1;
			if (nb > na) return -1;
			if (!isNaN(na) && isNaN(nb)) return 1;
			if (isNaN(na) && !isNaN(nb)) return -1;
		}
		return 0;
	};

	// UI methods to simulate user actions
	x.ui = {
		"click": function(selector,bubble) {
			if (typeof bubble != "boolean") {
				bubble = true;
			}
			x(selector).each(function() {
				var e = document.createEvent('MouseEvents');
				e.initEvent('click', bubble, true, window, 0);
				this.dispatchEvent(e);
			});
		},
		"keypress": function(selector,code,type) {
			type = type || "keypress";
			x(selector).each(function() {
				var e = document.createEvent('KeyboardEvent');
				if (typeof code == "string") {
					code = code.charCodeAt(0);
				}
				if (e.initKeyboardEvent) {
					e.initKeyboardEvent(type, true, true, window, code, null, null);
				}
				else if (e.initKeyEvent) {
					e.initKeyEvent(type, true, true, window, false, false, false, false, false, code);
				}
				this.dispatchEvent(e);
			});
		},
		"scroll":function(pixels,el) {
			var $el = x(el || window);
			var scrollTop = $el.scrollTop();
			if (typeof scrollTop=="number") {
				$el.scrollTop(scrollTop+pixels);
			}
		},
		"pointerover":function(el) {
			el.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
		},
		"pointerout":function(el) {
			el.dispatchEvent(new PointerEvent('pointerout', {bubbles: true}));
		},

	};

	// Draggable Objects
	x.draggable = function(el,dragend) {
		var $el = x(el);
		el = $el[0];
		$el.attr('draggable',true);
		var $undraggables = $el.find('*[draggable="false"]');
		if ($undraggables.length>0) {
			$undraggables.css({'cursor': 'auto'}).mouseenter(function() {$el.attr('draggable',false);}).mouseleave(function(e) {$el.attr('draggable',true);});
		}
		x.capture($el,'dragstart',function(ev) {
			x.draggable.dragend = dragend;
			ev.dataTransfer.setData("text/plain",(el.offsetLeft - ev.clientX) + ',' + (el.offsetTop - ev.clientY));
			x.draggable.target = $el;
		});
	};
	x.draggable.target = null;
	x.draggable.dragend = null;
	x.draggable.handlers = {
		dragover: function(ev) {
			if (x.draggable.target) {
				ev.preventDefault();
				return false;
			}
		},
		drop: function(ev) {
			if (x.draggable.target) {
				const offset = ev.dataTransfer.getData('text/plain').split(',').map(str => parseInt(str ))
				const $el = x.draggable.target;
				x.draggable.target = null;
				if (!isNaN(offset[0]) && !isNaN(offset[1])) {
					ev.preventDefault();
					let style = getComputedStyle($el[0]);
					let left = Math.max(0, ev.clientX + offset[0]) - parseFloat(style.marginLeft);
					let top  = Math.max(0, ev.clientY + offset[1]) - parseFloat(style.marginTop);
					$el.css('inset', `${top}px auto auto ${left}px`);
					if (typeof x.draggable.dragend === 'function') {
						x.draggable.dragend($el,left,top);
					}
					return false;
				}
			}
		},
		dragend: () => (x.draggable.target = null),
	};
	Object.keys(x.draggable.handlers).forEach(ev => x.capture(window,ev,x.draggable.handlers[ev]));

	// Observe DOM Changes
	x.on_attribute_change = function(el,attr,callback) {
		(new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				if (!attr || (mutation.attributeName==attr && el.getAttribute(attr)!=mutation.oldValue)) {
					callback(mutation.attributeName, mutation.oldValue, mutation.target[mutation.attributeName]);
				}
			});
		})).observe(el, {attributes: true, attributeOldValue: true});
	};
	x.on_childlist_change = function(el,callback) {
		(new MutationObserver(function(records) {
			for (var i=0; i<records.length; i++) {
				var r = records[i];
				if (r.type!=="childList" || !r.addedNodes || !r.addedNodes.length) { continue; }
				var added = r.addedNodes;
				for (var j=0; j<added.length; j++) {
					callback(added[j]);
				}
			}
		})).observe(el, { childList: true, subtree: true });
	};

	x.return_false = function(){return false;};

	x.is_document_ready = function() {
		if(document && document.readyState) { return (document.readyState=="interactive"||document.readyState=="complete"); }
		return (document && document.getElementsByTagName && document.getElementsByTagName('BODY').length>0);
	};

	// Notes to be emitted in any sort of Support report
	x.support_note = function(who, what) {
		if (typeof x.support_notes == "undefined") {
			x.support_notes = {};
		}
		if (what) {
		    x.support_notes[who] = { who, what, when: x.now() };
		} else {
		    delete x.support_notes[who];
		}
	};

	// X.getNodeVisibleText() and its utilities
	x.trim_cram = str => /^\s+$/.test(str) ? ' ' : str.replace(/[\n\r\s]+/g, ' ').trim();

	x.getContentValue = function(node,style) {
		if (!style || !style.content || style.content==='none') return '';
		var content = style.content || '';
		content=content.replace(/\s*attr\(([^)]+)\)\s*/g, function(x,m) {
			var a = node.getAttribute(m);
			return a ? '"' + a + '"' : '';
		});
		// Unquote quoted strings
		content = content.replace(/"(.*?[^\\])"/g,'$1');
		content = content.replace(/\\"/g,'"');
		content = content.replace(/^"(.*)"$/,'$1');
		if (!/inline/.test(style.display)) content = ' ' + content + ' ';
		return content;
	};

	x.getChildrenVisibleText = function(node, direction, display, flexDirection) {
		if (!node.childNodes || !node.childNodes.length) return '';
		const flex = /flex/.test(display);
		const grid = /grid/.test(display);
		const flexgrid = flex || grid;
		const row  = flexgrid && /row/.test(flexDirection);
		const col  = flexgrid && /column/.test(flexDirection);
		const rev  = (row || col) && /reverse/.test(flexDirection);
		const rtl  = !col && /rtl/.test(direction);
		const otherway = (!flexgrid && rtl) || (flex && row && (rev != rtl)) || (flex && col && rev);

		var val = [];
		node.childNodes.forEach(child => {
			const order = !flexgrid || ((child.nodeType == node.TEXT_NODE) ? -0.5 : getComputedStyle(child).order);
			val.push([order, x.getNodeVisibleText(child)]);
		});
		flexgrid && (val = val.sort((a,b) => a[0] - b[0]));
		otherway && (val = val.reverse());
		return val.map(a => a[1]).join('');
	};

	x.getNodeVisibleText = function(node) {
		if (!node || (node.nodeType !== node.ELEMENT_NODE && node.nodeType !== node.TEXT_NODE)) {
			return '';
		}
		if (node.nodeType === node.TEXT_NODE) {
			return X.trim_cram(node.nodeValue)
		}
		if (node.nodeName == 'use') {
			// Recursively call getNodeVisibleText()?  Could lead to infinite
			// loop.  Revisit if FB Dept. Of Evil decide to send us there...
			let use_target = document.querySelector(node.getAttribute('xlink:href'));
			if (use_target.nodeName == 'text') {
				return X.trim_cram(use_target.textContent)
			}
		}
		// Make sure it's not hidden
		var tmp;
		const style = getComputedStyle(node);
		const tween = ((prop, min, max) =>
			style[prop] !== 'auto' && (tmp = parseFloat(style[prop])) > min && tmp < max);
		if (   'none' === style.display
		    || 'fixed' === style.position
		    || 'hidden' === style.visibility
		    || 'absolute' === style.position
		 // || !tween('left', -1000, 1500)
		 // || !tween('marginLeft', -1000, 1500)
		 // || !tween('right', -1500, 1000)
		    || tween('width', -Infinity, 2)
		    || tween('height', -Infinity, 2)
		    || tween('opacity', -Infinity, 0.1)
		    || tween('fontSize', -Infinity, 3.5)
		    || (style.lineHeight !== 'normal' && tween('lineHeight', -Infinity, 2))
		) {
			return '';
		}

		var val = '';

		// Get the :before content, if any
		val += x.getContentValue(node, getComputedStyle(node,"::before"));

		// Process child nodes, including text
		val += x.getChildrenVisibleText(node, style.direction, style.display, style.flexDirection);

		// Get the :after content, if any
		val += x.getContentValue(node, getComputedStyle(node,"::after"));

		// Add separation for block content
		if (!/inline/.test(style.display)) val = ' ' + val + ' ';

		return X.trim_cram(val)
	};

	x.clipboard = {
		// Copies whatever is passed or selected on screen
		copy: function(txt) {
			try {
				if (!txt) {
					txt = window.getSelection().toString();
				}
				if (!txt) {
					return;
				}
				if (navigator && navigator.clipboard) {
					return navigator.clipboard.writeText(txt);
				} else if (document.execCommand) {
					document.execCommand("copy");
				}
			} catch(e) {
				x.log("Could not copy text: "+e.toString());
			}
		}
	};

	// A "Ready" queue of functions to run once the event is triggered
	x.ready = (function() {
		const log = x.logger('X.ready');
		var queue=[];
		var ready=false;
		var fire = function(o) {
			try {
				log(`start: '${o.label}'`);
				o.func();
			} catch(e) {
				log(`ERROR: '${o.label}:'\n'${e}'`);
			}
		};
		return function(label,func) {
			if (typeof label === 'undefined') {
				// No arg passed, fire the queue
				ready = true;
				log(`firing ${queue.length} queued modules`);
				queue.forEach(fire);
				log(`${queue.length} modules started`);
				delete queue;
				return;
			}
			if (typeof label === 'function') {
				func = label;
				label = '[nameless]';
			}
			if (typeof func === 'function') {
				const o = { label, func, };
				ready ? fire(o) : queue.push(o);
			}
		};
	})();

	// beforeReady() allows modules to halt execution or do things before normal execution
	x.beforeReady = (function() {
		var i,queue=[];
		return function(f) {
			if (typeof f!="function") {
				// fire the queue
				for (i=0; i<queue.length; i++) {
					if (queue[i](f)===false) {
						return false;
					}
				}
			}
			else {
				queue.push( f );
			}
		};
	})();

	// A text-based query that can run methods, not just selectors
	x.query = function(q,run_funcs_for_each_element) {
		run_funcs_for_each_element = run_funcs_for_each_element || true;
		var i,j ;
		// If this query doesn't need special processings, just run it as a CSS selector
		//if (typeof q!="string" || !/\|/.test(q)) { return x(q); }
		var parts = q.split("|");
		var n = parts.length;
		var $els = x(parts[0]);
		var $collections = [];
		for (i=0; i<$els.length; i++) {
			$collections.push(x($els[i]));
		}
		var args=[];
		var part = null;
		for (i=1; i<n; i++) {
			args = [];
			part = parts[i];
			// Parse out function arguments
			part = part.replace(/\((.*?)\)/, function(m,m1) {
				args = (m1||'').split(/,/);
				return '';
			});
			if (typeof x.fn[part]!="function") { throw "Invalid X function: "+part; }
			if (run_funcs_for_each_element) {
				for (j=0; j<$collections.length; j++) {
					var $el = $collections[j];
					$collections[j] = x($el)[part].apply($el,args);
				}
			}
			else {
				$els = $els[part].apply($els, args);
			}
		}
		if (run_funcs_for_each_element) {
			return $collections;
		}
		return $els;
	};

	// Synchronously sleep for the specified number of seconds (fractions OK).
	// Usage: await X.sleep(3.5); -- waits 3.5s.
	// Caller function must be declared 'async'.
	x.sleep = async function(seconds) {
		await new Promise(resolve => setTimeout(resolve, seconds * x.seconds));
	};

	return x;
};
var X = XLib();

/*!
 * Vue.js v1.0.28
 * (c) 2016 Evan You
 * Released under the MIT License.
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.Vue=e()}(this,function(){"use strict";function t(e,n,r){if(i(e,n))return void(e[n]=r);if(e._isVue)return void t(e._data,n,r);var s=e.__ob__;if(!s)return void(e[n]=r);if(s.convert(n,r),s.dep.notify(),s.vms)for(var o=s.vms.length;o--;){var a=s.vms[o];a._proxy(n),a._digest()}return r}function e(t,e){if(i(t,e)){delete t[e];var n=t.__ob__;if(!n)return void(t._isVue&&(delete t._data[e],t._digest()));if(n.dep.notify(),n.vms)for(var r=n.vms.length;r--;){var s=n.vms[r];s._unproxy(e),s._digest()}}}function i(t,e){return Mi.call(t,e)}function n(t){return Wi.test(t)}function r(t){var e=(t+"").charCodeAt(0);return 36===e||95===e}function s(t){return null==t?"":t.toString()}function o(t){if("string"!=typeof t)return t;var e=Number(t);return isNaN(e)?t:e}function a(t){return"true"===t||"false"!==t&&t}function h(t){var e=t.charCodeAt(0),i=t.charCodeAt(t.length-1);return e!==i||34!==e&&39!==e?t:t.slice(1,-1)}function l(t){return t.replace(Vi,c)}function c(t,e){return e?e.toUpperCase():""}function u(t){return t.replace(Bi,"$1-$2").replace(Bi,"$1-$2").toLowerCase()}function f(t){return t.replace(zi,c)}function p(t,e){return function(i){var n=arguments.length;return n?n>1?t.apply(e,arguments):t.call(e,i):t.call(e)}}function d(t,e){e=e||0;for(var i=t.length-e,n=new Array(i);i--;)n[i]=t[i+e];return n}function v(t,e){for(var i=Object.keys(e),n=i.length;n--;)t[i[n]]=e[i[n]];return t}function m(t){return null!==t&&"object"==typeof t}function g(t){return Ui.call(t)===Ji}function _(t,e,i,n){Object.defineProperty(t,e,{value:i,enumerable:!!n,writable:!0,configurable:!0})}function y(t,e){var i,n,r,s,o,a=function a(){var h=Date.now()-s;h<e&&h>=0?i=setTimeout(a,e-h):(i=null,o=t.apply(r,n),i||(r=n=null))};return function(){return r=this,n=arguments,s=Date.now(),i||(i=setTimeout(a,e)),o}}function b(t,e){for(var i=t.length;i--;)if(t[i]===e)return i;return-1}function w(t){var e=function e(){if(!e.cancelled)return t.apply(this,arguments)};return e.cancel=function(){e.cancelled=!0},e}function C(t,e){return t==e||!(!m(t)||!m(e))&&JSON.stringify(t)===JSON.stringify(e)}function $(t){return/native code/.test(t.toString())}function k(t){this.size=0,this.limit=t,this.head=this.tail=void 0,this._keymap=Object.create(null)}function x(){return fn.charCodeAt(vn+1)}function A(){return fn.charCodeAt(++vn)}function O(){return vn>=dn}function T(){for(;x()===Tn;)A()}function N(t){return t===kn||t===xn}function j(t){return Nn[t]}function E(t,e){return jn[t]===e}function S(){for(var t,e=A();!O();)if(t=A(),t===On)A();else if(t===e)break}function F(t){for(var e=0,i=t;!O();)if(t=x(),N(t))S();else if(i===t&&e++,E(i,t)&&e--,A(),0===e)break}function D(){for(var t=vn;!O();)if(mn=x(),N(mn))S();else if(j(mn))F(mn);else if(mn===An){if(A(),mn=x(),mn!==An){gn!==bn&&gn!==$n||(gn=wn);break}A()}else{if(mn===Tn&&(gn===Cn||gn===$n)){T();break}gn===wn&&(gn=Cn),A()}return fn.slice(t+1,vn)||null}function P(){for(var t=[];!O();)t.push(R());return t}function R(){var t,e={};return gn=wn,e.name=D().trim(),gn=$n,t=L(),t.length&&(e.args=t),e}function L(){for(var t=[];!O()&&gn!==wn;){var e=D();if(!e)break;t.push(H(e))}return t}function H(t){if(yn.test(t))return{value:o(t),dynamic:!1};var e=h(t),i=e===t;return{value:i?t:e,dynamic:i}}function I(t){var e=_n.get(t);if(e)return e;fn=t,pn={},dn=fn.length,vn=-1,mn="",gn=bn;var i;return fn.indexOf("|")<0?pn.expression=fn.trim():(pn.expression=D().trim(),i=P(),i.length&&(pn.filters=i)),_n.put(t,pn),pn}function M(t){return t.replace(Sn,"\\$&")}function W(){var t=M(Mn.delimiters[0]),e=M(Mn.delimiters[1]),i=M(Mn.unsafeDelimiters[0]),n=M(Mn.unsafeDelimiters[1]);Dn=new RegExp(i+"((?:.|\\n)+?)"+n+"|"+t+"((?:.|\\n)+?)"+e,"g"),Pn=new RegExp("^"+i+"((?:.|\\n)+?)"+n+"$"),Fn=new k(1e3)}function V(t){Fn||W();var e=Fn.get(t);if(e)return e;if(!Dn.test(t))return null;for(var i,n,r,s,o,a,h=[],l=Dn.lastIndex=0;i=Dn.exec(t);)n=i.index,n>l&&h.push({value:t.slice(l,n)}),r=Pn.test(i[0]),s=r?i[1]:i[2],o=s.charCodeAt(0),a=42===o,s=a?s.slice(1):s,h.push({tag:!0,value:s.trim(),html:r,oneTime:a}),l=n+i[0].length;return l<t.length&&h.push({value:t.slice(l)}),Fn.put(t,h),h}function B(t,e){return t.length>1?t.map(function(t){return z(t,e)}).join("+"):z(t[0],e,!0)}function z(t,e,i){return t.tag?t.oneTime&&e?'"'+e.$eval(t.value)+'"':U(t.value,i):'"'+t.value+'"'}function U(t,e){if(Rn.test(t)){var i=I(t);return i.filters?"this._applyFilters("+i.expression+",null,"+JSON.stringify(i.filters)+",false)":"("+t+")"}return e?t:"("+t+")"}function J(t,e,i,n){G(t,1,function(){e.appendChild(t)},i,n)}function q(t,e,i,n){G(t,1,function(){et(t,e)},i,n)}function Q(t,e,i){G(t,-1,function(){nt(t)},e,i)}function G(t,e,i,n,r){var s=t.__v_trans;if(!s||!s.hooks&&!rn||!n._isCompiled||n.$parent&&!n.$parent._isCompiled)return i(),void(r&&r());var o=e>0?"enter":"leave";s[o](i,r)}function Z(t){if("string"==typeof t){t=document.querySelector(t)}return t}function X(t){if(!t)return!1;var e=t.ownerDocument.documentElement,i=t.parentNode;return e===t||e===i||!(!i||1!==i.nodeType||!e.contains(i))}function Y(t,e){var i=t.getAttribute(e);return null!==i&&t.removeAttribute(e),i}function K(t,e){var i=Y(t,":"+e);return null===i&&(i=Y(t,"v-bind:"+e)),i}function tt(t,e){return t.hasAttribute(e)||t.hasAttribute(":"+e)||t.hasAttribute("v-bind:"+e)}function et(t,e){e.parentNode.insertBefore(t,e)}function it(t,e){e.nextSibling?et(t,e.nextSibling):e.parentNode.appendChild(t)}function nt(t){t.parentNode.removeChild(t)}function rt(t,e){e.firstChild?et(t,e.firstChild):e.appendChild(t)}function st(t,e){var i=t.parentNode;i&&i.replaceChild(e,t)}function ot(t,e,i,n){t.addEventListener(e,i,n)}function at(t,e,i){t.removeEventListener(e,i)}function ht(t){var e=t.className;return"object"==typeof e&&(e=e.baseVal||""),e}function lt(t,e){Ki&&!/svg$/.test(t.namespaceURI)?t.className=e:t.setAttribute("class",e)}function ct(t,e){if(t.classList)t.classList.add(e);else{var i=" "+ht(t)+" ";i.indexOf(" "+e+" ")<0&&lt(t,(i+e).trim())}}function ut(t,e){if(t.classList)t.classList.remove(e);else{for(var i=" "+ht(t)+" ",n=" "+e+" ";i.indexOf(n)>=0;)i=i.replace(n," ");lt(t,i.trim())}t.className||t.removeAttribute("class")}function ft(t,e){var i,n;if(vt(t)&&bt(t.content)&&(t=t.content),t.hasChildNodes())for(pt(t),n=e?document.createDocumentFragment():document.createElement("div");i=t.firstChild;)n.appendChild(i);return n}function pt(t){for(var e;e=t.firstChild,dt(e);)t.removeChild(e);for(;e=t.lastChild,dt(e);)t.removeChild(e)}function dt(t){return t&&(3===t.nodeType&&!t.data.trim()||8===t.nodeType)}function vt(t){return t.tagName&&"template"===t.tagName.toLowerCase()}function mt(t,e){var i=Mn.debug?document.createComment(t):document.createTextNode(e?" ":"");return i.__v_anchor=!0,i}function gt(t){if(t.hasAttributes())for(var e=t.attributes,i=0,n=e.length;i<n;i++){var r=e[i].name;if(Bn.test(r))return l(r.replace(Bn,""))}}function _t(t,e,i){for(var n;t!==e;)n=t.nextSibling,i(t),t=n;i(e)}function yt(t,e,i,n,r){function s(){if(a++,o&&a>=h.length){for(var t=0;t<h.length;t++)n.appendChild(h[t]);r&&r()}}var o=!1,a=0,h=[];_t(t,e,function(t){t===e&&(o=!0),h.push(t),Q(t,i,s)})}function bt(t){return t&&11===t.nodeType}function wt(t){if(t.outerHTML)return t.outerHTML;var e=document.createElement("div");return e.appendChild(t.cloneNode(!0)),e.innerHTML}function Ct(t,e){var i=t.tagName.toLowerCase(),n=t.hasAttributes();if(zn.test(i)||Un.test(i)){if(n)return $t(t,e)}else{if(jt(e,"components",i))return{id:i};var r=n&&$t(t,e);if(r)return r}}function $t(t,e){var i=t.getAttribute("is");if(null!=i){if(jt(e,"components",i))return t.removeAttribute("is"),{id:i}}else if(i=K(t,"is"),null!=i)return{id:i,dynamic:!0}}function kt(e,n){var r,s,o;for(r in n)s=e[r],o=n[r],i(e,r)?m(s)&&m(o)&&kt(s,o):t(e,r,o);return e}function xt(t,e){var i=Object.create(t||null);return e?v(i,Tt(e)):i}function At(t){if(t.components)for(var e,i=t.components=Tt(t.components),n=Object.keys(i),r=0,s=n.length;r<s;r++){var o=n[r];zn.test(o)||Un.test(o)||(e=i[o],g(e)&&(i[o]=Di.extend(e)))}}function Ot(t){var e,i,n=t.props;if(qi(n))for(t.props={},e=n.length;e--;)i=n[e],"string"==typeof i?t.props[i]=null:i.name&&(t.props[i.name]=i);else if(g(n)){var r=Object.keys(n);for(e=r.length;e--;)i=n[r[e]],"function"==typeof i&&(n[r[e]]={type:i})}}function Tt(t){if(qi(t)){for(var e,i={},n=t.length;n--;){e=t[n];var r="function"==typeof e?e.options&&e.options.name||e.id:e.name||e.id;r&&(i[r]=e)}return i}return t}function Nt(t,e,n){function r(i){var r=Jn[i]||qn;o[i]=r(t[i],e[i],n,i)}At(e),Ot(e);var s,o={};if(e.extends&&(t="function"==typeof e.extends?Nt(t,e.extends.options,n):Nt(t,e.extends,n)),e.mixins)for(var a=0,h=e.mixins.length;a<h;a++){var l=e.mixins[a],c=l.prototype instanceof Di?l.options:l;t=Nt(t,c,n)}for(s in t)r(s);for(s in e)i(t,s)||r(s);return o}function jt(t,e,i,n){if("string"==typeof i){var r,s=t[e],o=s[i]||s[r=l(i)]||s[r.charAt(0).toUpperCase()+r.slice(1)];return o}}function Et(){this.id=Qn++,this.subs=[]}function St(t){Yn=!1,t(),Yn=!0}function Ft(t){if(this.value=t,this.dep=new Et,_(t,"__ob__",this),qi(t)){var e=Qi?Dt:Pt;e(t,Zn,Xn),this.observeArray(t)}else this.walk(t)}function Dt(t,e){t.__proto__=e}function Pt(t,e,i){for(var n=0,r=i.length;n<r;n++){var s=i[n];_(t,s,e[s])}}function Rt(t,e){if(t&&"object"==typeof t){var n;return i(t,"__ob__")&&t.__ob__ instanceof Ft?n=t.__ob__:Yn&&(qi(t)||g(t))&&Object.isExtensible(t)&&!t._isVue&&(n=new Ft(t)),n&&e&&n.addVm(e),n}}function Lt(t,e,i){var n=new Et,r=Object.getOwnPropertyDescriptor(t,e);if(!r||r.configurable!==!1){var s=r&&r.get,o=r&&r.set,a=Rt(i);Object.defineProperty(t,e,{enumerable:!0,configurable:!0,get:function(){var e=s?s.call(t):i;if(Et.target&&(n.depend(),a&&a.dep.depend(),qi(e)))for(var r,o=0,h=e.length;o<h;o++)r=e[o],r&&r.__ob__&&r.__ob__.dep.depend();return e},set:function(e){var r=s?s.call(t):i;e!==r&&(o?o.call(t,e):i=e,a=Rt(e),n.notify())}})}}function Ht(t){t.prototype._init=function(t){t=t||{},this.$el=null,this.$parent=t.parent,this.$root=this.$parent?this.$parent.$root:this,this.$children=[],this.$refs={},this.$els={},this._watchers=[],this._directives=[],this._uid=tr++,this._isVue=!0,this._events={},this._eventsCount={},this._isFragment=!1,this._fragment=this._fragmentStart=this._fragmentEnd=null,this._isCompiled=this._isDestroyed=this._isReady=this._isAttached=this._isBeingDestroyed=this._vForRemoving=!1,this._unlinkFn=null,this._context=t._context||this.$parent,this._scope=t._scope,this._frag=t._frag,this._frag&&this._frag.children.push(this),this.$parent&&this.$parent.$children.push(this),t=this.$options=Nt(this.constructor.options,t,this),this._updateRef(),this._data={},this._callHook("init"),this._initState(),this._initEvents(),this._callHook("created"),t.el&&this.$mount(t.el)}}function It(t){if(void 0===t)return"eof";var e=t.charCodeAt(0);switch(e){case 91:case 93:case 46:case 34:case 39:case 48:return t;case 95:case 36:return"ident";case 32:case 9:case 10:case 13:case 160:case 65279:case 8232:case 8233:return"ws"}return e>=97&&e<=122||e>=65&&e<=90?"ident":e>=49&&e<=57?"number":"else"}function Mt(t){var e=t.trim();return("0"!==t.charAt(0)||!isNaN(t))&&(n(e)?h(e):"*"+e)}function Wt(t){function e(){var e=t[c+1];if(u===ur&&"'"===e||u===fr&&'"'===e)return c++,n="\\"+e,p[ir](),!0}var i,n,r,s,o,a,h,l=[],c=-1,u=or,f=0,p=[];for(p[nr]=function(){void 0!==r&&(l.push(r),r=void 0)},p[ir]=function(){void 0===r?r=n:r+=n},p[rr]=function(){p[ir](),f++},p[sr]=function(){if(f>0)f--,u=cr,p[ir]();else{if(f=0,r=Mt(r),r===!1)return!1;p[nr]()}};null!=u;)if(c++,i=t[c],"\\"!==i||!e()){if(s=It(i),h=vr[u],o=h[s]||h.else||dr,o===dr)return;if(u=o[0],a=p[o[1]],a&&(n=o[2],n=void 0===n?i:n,a()===!1))return;if(u===pr)return l.raw=t,l}}function Vt(t){var e=er.get(t);return e||(e=Wt(t),e&&er.put(t,e)),e}function Bt(t,e){return Yt(e).get(t)}function zt(e,i,n){var r=e;if("string"==typeof i&&(i=Wt(i)),!i||!m(e))return!1;for(var s,o,a=0,h=i.length;a<h;a++)s=e,o=i[a],"*"===o.charAt(0)&&(o=Yt(o.slice(1)).get.call(r,r)),a<h-1?(e=e[o],m(e)||(e={},t(s,o,e))):qi(e)?e.$set(o,n):o in e?e[o]=n:t(e,o,n);return!0}function Ut(){}function Jt(t,e){var i=Nr.length;return Nr[i]=e?t.replace($r,"\\n"):t,'"'+i+'"'}function qt(t){var e=t.charAt(0),i=t.slice(1);return yr.test(i)?t:(i=i.indexOf('"')>-1?i.replace(xr,Qt):i,e+"scope."+i)}function Qt(t,e){return Nr[e]}function Gt(t){wr.test(t),Nr.length=0;var e=t.replace(kr,Jt).replace(Cr,"");return e=(" "+e).replace(Or,qt).replace(xr,Qt),Zt(e)}function Zt(t){try{return new Function("scope","return "+t+";")}catch(t){return Ut}}function Xt(t){var e=Vt(t);if(e)return function(t,i){zt(t,e,i)}}function Yt(t,e){t=t.trim();var i=gr.get(t);if(i)return e&&!i.set&&(i.set=Xt(i.exp)),i;var n={exp:t};return n.get=Kt(t)&&t.indexOf("[")<0?Zt("scope."+t):Gt(t),e&&(n.set=Xt(t)),gr.put(t,n),n}function Kt(t){return Ar.test(t)&&!Tr.test(t)&&"Math."!==t.slice(0,5)}function te(){Er.length=0,Sr.length=0,Fr={},Dr={},Pr=!1}function ee(){for(var t=!0;t;)t=!1,ie(Er),ie(Sr),Er.length?t=!0:(Zi&&Mn.devtools&&Zi.emit("flush"),te())}function ie(t){for(var e=0;e<t.length;e++){var i=t[e],n=i.id;Fr[n]=null,i.run()}t.length=0}function ne(t){var e=t.id;if(null==Fr[e]){var i=t.user?Sr:Er;Fr[e]=i.length,i.push(t),Pr||(Pr=!0,ln(ee))}}function re(t,e,i,n){n&&v(this,n);var r="function"==typeof e;if(this.vm=t,t._watchers.push(this),this.expression=e,this.cb=i,this.id=++Rr,this.active=!0,this.dirty=this.lazy,this.deps=[],this.newDeps=[],this.depIds=new cn,this.newDepIds=new cn,this.prevError=null,r)this.getter=e,this.setter=void 0;else{var s=Yt(e,this.twoWay);this.getter=s.get,this.setter=s.set}this.value=this.lazy?void 0:this.get(),this.queued=this.shallow=!1}function se(t,e){var i=void 0,n=void 0;e||(e=Lr,e.clear());var r=qi(t),s=m(t);if((r||s)&&Object.isExtensible(t)){if(t.__ob__){var o=t.__ob__.dep.id;if(e.has(o))return;e.add(o)}if(r)for(i=t.length;i--;)se(t[i],e);else if(s)for(n=Object.keys(t),i=n.length;i--;)se(t[n[i]],e)}}function oe(t){return vt(t)&&bt(t.content)}function ae(t,e){var i=e?t:t.trim(),n=Ir.get(i);if(n)return n;var r=document.createDocumentFragment(),s=t.match(Vr),o=Br.test(t),a=zr.test(t);if(s||o||a){var h=s&&s[1],l=Wr[h]||Wr.efault,c=l[0],u=l[1],f=l[2],p=document.createElement("div");for(p.innerHTML=u+t+f;c--;)p=p.lastChild;for(var d;d=p.firstChild;)r.appendChild(d)}else r.appendChild(document.createTextNode(t));return e||pt(r),Ir.put(i,r),r}function he(t){if(oe(t))return ae(t.innerHTML);if("SCRIPT"===t.tagName)return ae(t.textContent);for(var e,i=le(t),n=document.createDocumentFragment();e=i.firstChild;)n.appendChild(e);return pt(n),n}function le(t){if(!t.querySelectorAll)return t.cloneNode();var e,i,n,r=t.cloneNode(!0);if(Ur){var s=r;if(oe(t)&&(t=t.content,s=r.content),i=t.querySelectorAll("template"),i.length)for(n=s.querySelectorAll("template"),e=n.length;e--;)n[e].parentNode.replaceChild(le(i[e]),n[e])}if(Jr)if("TEXTAREA"===t.tagName)r.value=t.value;else if(i=t.querySelectorAll("textarea"),i.length)for(n=r.querySelectorAll("textarea"),e=n.length;e--;)n[e].value=i[e].value;return r}function ce(t,e,i){var n,r;return bt(t)?(pt(t),e?le(t):t):("string"==typeof t?i||"#"!==t.charAt(0)?r=ae(t,i):(r=Mr.get(t),r||(n=document.getElementById(t.slice(1)),n&&(r=he(n),Mr.put(t,r)))):t.nodeType&&(r=he(t)),r&&e?le(r):r)}function ue(t,e,i,n,r,s){this.children=[],this.childFrags=[],this.vm=e,this.scope=r,this.inserted=!1,this.parentFrag=s,s&&s.childFrags.push(this),this.unlink=t(e,i,n,r,this);var o=this.single=1===i.childNodes.length&&!i.childNodes[0].__v_anchor;o?(this.node=i.childNodes[0],this.before=fe,this.remove=pe):(this.node=mt("fragment-start"),this.end=mt("fragment-end"),this.frag=i,rt(this.node,i),i.appendChild(this.end),this.before=de,this.remove=ve),this.node.__v_frag=this}function fe(t,e){this.inserted=!0;var i=e!==!1?q:et;i(this.node,t,this.vm),X(this.node)&&this.callHook(me)}function pe(){this.inserted=!1;var t=X(this.node),e=this;this.beforeRemove(),Q(this.node,this.vm,function(){t&&e.callHook(ge),e.destroy()})}function de(t,e){this.inserted=!0;var i=this.vm,n=e!==!1?q:et;_t(this.node,this.end,function(e){n(e,t,i)}),X(this.node)&&this.callHook(me)}function ve(){this.inserted=!1;var t=this,e=X(this.node);this.beforeRemove(),yt(this.node,this.end,this.vm,this.frag,function(){e&&t.callHook(ge),t.destroy()})}function me(t){!t._isAttached&&X(t.$el)&&t._callHook("attached")}function ge(t){t._isAttached&&!X(t.$el)&&t._callHook("detached")}function _e(t,e){this.vm=t;var i,n="string"==typeof e;n||vt(e)&&!e.hasAttribute("v-if")?i=ce(e,!0):(i=document.createDocumentFragment(),i.appendChild(e)),this.template=i;var r,s=t.constructor.cid;if(s>0){var o=s+(n?e:wt(e));r=Gr.get(o),r||(r=qe(i,t.$options,!0),Gr.put(o,r))}else r=qe(i,t.$options,!0);this.linker=r}function ye(t,e,i){var n=t.node.previousSibling;if(n){for(t=n.__v_frag;!(t&&t.forId===i&&t.inserted||n===e);){if(n=n.previousSibling,!n)return;t=n.__v_frag}return t}}function be(t){for(var e=-1,i=new Array(Math.floor(t));++e<t;)i[e]=e;return i}function we(t,e,i,n){return n?"$index"===n?t:n.charAt(0).match(/\w/)?Bt(i,n):i[n]:e||i}function Ce(t){var e=t.node;if(t.end)for(;!e.__vue__&&e!==t.end&&e.nextSibling;)e=e.nextSibling;return e.__vue__}function $e(t,e,i){for(var n,r,s,o=e?[]:null,a=0,h=t.options.length;a<h;a++)if(n=t.options[a],s=i?n.hasAttribute("selected"):n.selected){if(r=n.hasOwnProperty("_value")?n._value:n.value,!e)return r;o.push(r)}return o}function ke(t,e){for(var i=t.length;i--;)if(C(t[i],e))return i;return-1}function xe(t,e){var i=e.map(function(t){var e=t.charCodeAt(0);return e>47&&e<58?parseInt(t,10):1===t.length&&(e=t.toUpperCase().charCodeAt(0),e>64&&e<91)?e:ms[t]});return i=[].concat.apply([],i),function(e){if(i.indexOf(e.keyCode)>-1)return t.call(this,e)}}function Ae(t){return function(e){return e.stopPropagation(),t.call(this,e)}}function Oe(t){return function(e){return e.preventDefault(),t.call(this,e)}}function Te(t){return function(e){if(e.target===e.currentTarget)return t.call(this,e)}}function Ne(t){if(ws[t])return ws[t];var e=je(t);return ws[t]=ws[e]=e,e}function je(t){t=u(t);var e=l(t),i=e.charAt(0).toUpperCase()+e.slice(1);Cs||(Cs=document.createElement("div"));var n,r=_s.length;if("filter"!==e&&e in Cs.style)return{kebab:t,camel:e};for(;r--;)if(n=ys[r]+i,n in Cs.style)return{kebab:_s[r]+t,camel:n}}function Ee(t){var e=[];if(qi(t))for(var i=0,n=t.length;i<n;i++){var r=t[i];if(r)if("string"==typeof r)e.push(r);else for(var s in r)r[s]&&e.push(s)}else if(m(t))for(var o in t)t[o]&&e.push(o);return e}function Se(t,e,i){if(e=e.trim(),e.indexOf(" ")===-1)return void i(t,e);for(var n=e.split(/\s+/),r=0,s=n.length;r<s;r++)i(t,n[r])}function Fe(t,e,i){function n(){++s>=r?i():t[s].call(e,n)}var r=t.length,s=0;t[0].call(e,n)}function De(t,e,i){for(var r,s,o,a,h,c,f,p=[],d=i.$options.propsData,v=Object.keys(e),m=v.length;m--;)s=v[m],r=e[s]||Hs,h=l(s),Is.test(h)&&(f={name:s,path:h,options:r,mode:Ls.ONE_WAY,raw:null},o=u(s),null===(a=K(t,o))&&(null!==(a=K(t,o+".sync"))?f.mode=Ls.TWO_WAY:null!==(a=K(t,o+".once"))&&(f.mode=Ls.ONE_TIME)),null!==a?(f.raw=a,c=I(a),a=c.expression,f.filters=c.filters,n(a)&&!c.filters?f.optimizedLiteral=!0:f.dynamic=!0,f.parentPath=a):null!==(a=Y(t,o))?f.raw=a:d&&null!==(a=d[s]||d[h])&&(f.raw=a),p.push(f));return Pe(p)}function Pe(t){return function(e,n){e._props={};for(var r,s,l,c,f,p=e.$options.propsData,d=t.length;d--;)if(r=t[d],f=r.raw,s=r.path,l=r.options,e._props[s]=r,p&&i(p,s)&&Le(e,r,p[s]),null===f)Le(e,r,void 0);else if(r.dynamic)r.mode===Ls.ONE_TIME?(c=(n||e._context||e).$get(r.parentPath),Le(e,r,c)):e._context?e._bindDir({name:"prop",def:Ws,prop:r},null,null,n):Le(e,r,e.$get(r.parentPath));else if(r.optimizedLiteral){var v=h(f);c=v===f?a(o(f)):v,Le(e,r,c)}else c=l.type===Boolean&&(""===f||f===u(r.name))||f,Le(e,r,c)}}function Re(t,e,i,n){var r=e.dynamic&&Kt(e.parentPath),s=i;void 0===s&&(s=Ie(t,e)),s=We(e,s,t);var o=s!==i;Me(e,s,t)||(s=void 0),r&&!o?St(function(){n(s)}):n(s)}function Le(t,e,i){Re(t,e,i,function(i){Lt(t,e.path,i)})}function He(t,e,i){Re(t,e,i,function(i){t[e.path]=i})}function Ie(t,e){var n=e.options;if(!i(n,"default"))return n.type!==Boolean&&void 0;var r=n.default;return m(r),"function"==typeof r&&n.type!==Function?r.call(t):r}function Me(t,e,i){if(!t.options.required&&(null===t.raw||null==e))return!0;var n=t.options,r=n.type,s=!r,o=[];if(r){qi(r)||(r=[r]);for(var a=0;a<r.length&&!s;a++){var h=Ve(e,r[a]);o.push(h.expectedType),s=h.valid}}if(!s)return!1;var l=n.validator;return!(l&&!l(e))}function We(t,e,i){var n=t.options.coerce;return n&&"function"==typeof n?n(e):e}function Ve(t,e){var i,n;return e===String?(n="string",i=typeof t===n):e===Number?(n="number",i=typeof t===n):e===Boolean?(n="boolean",i=typeof t===n):e===Function?(n="function",i=typeof t===n):e===Object?(n="object",i=g(t)):e===Array?(n="array",i=qi(t)):i=t instanceof e,{valid:i,expectedType:n}}function Be(t){Vs.push(t),Bs||(Bs=!0,ln(ze))}function ze(){for(var t=document.documentElement.offsetHeight,e=0;e<Vs.length;e++)Vs[e]();return Vs=[],Bs=!1,t}function Ue(t,e,i,n){this.id=e,this.el=t,this.enterClass=i&&i.enterClass||e+"-enter",this.leaveClass=i&&i.leaveClass||e+"-leave",this.hooks=i,this.vm=n,this.pendingCssEvent=this.pendingCssCb=this.cancel=this.pendingJsCb=this.op=this.cb=null,this.justEntered=!1,this.entered=this.left=!1,this.typeCache={},this.type=i&&i.type;var r=this;["enterNextTick","enterDone","leaveNextTick","leaveDone"].forEach(function(t){r[t]=p(r[t],r)})}function Je(t){if(/svg$/.test(t.namespaceURI)){var e=t.getBoundingClientRect();return!(e.width||e.height)}return!(t.offsetWidth||t.offsetHeight||t.getClientRects().length)}function qe(t,e,i){var n=i||!e._asComponent?ti(t,e):null,r=n&&n.terminal||gi(t)||!t.hasChildNodes()?null:oi(t.childNodes,e);return function(t,e,i,s,o){var a=d(e.childNodes),h=Qe(function(){n&&n(t,e,i,s,o),r&&r(t,a,i,s,o)},t);return Ze(t,h)}}function Qe(t,e){e._directives=[];var i=e._directives.length;t();var n=e._directives.slice(i);Ge(n);for(var r=0,s=n.length;r<s;r++)n[r]._bind();return n}function Ge(t){if(0!==t.length){var e,i,n,r,s={},o=0,a=[];for(e=0,i=t.length;e<i;e++){var h=t[e],l=h.descriptor.def.priority||ro,c=s[l];c||(c=s[l]=[],a.push(l)),c.push(h)}for(a.sort(function(t,e){return t>e?-1:t===e?0:1}),e=0,i=a.length;e<i;e++){var u=s[a[e]];for(n=0,r=u.length;n<r;n++)t[o++]=u[n]}}}function Ze(t,e,i,n){function r(r){Xe(t,e,r),i&&n&&Xe(i,n)}return r.dirs=e,r}function Xe(t,e,i){for(var n=e.length;n--;)e[n]._teardown()}function Ye(t,e,i,n){var r=De(e,i,t),s=Qe(function(){r(t,n)},t);return Ze(t,s)}function Ke(t,e,i){var n,r,s=e._containerAttrs,o=e._replacerAttrs;return 11!==t.nodeType&&(e._asComponent?(s&&i&&(n=pi(s,i)),o&&(r=pi(o,e))):r=pi(t.attributes,e)),e._containerAttrs=e._replacerAttrs=null,function(t,e,i){var s,o=t._context;o&&n&&(s=Qe(function(){n(o,e,null,i)},o));var a=Qe(function(){r&&r(t,e)},t);return Ze(t,a,o,s)}}function ti(t,e){var i=t.nodeType;return 1!==i||gi(t)?3===i&&t.data.trim()?ii(t,e):null:ei(t,e)}function ei(t,e){if("TEXTAREA"===t.tagName){if(null!==Y(t,"v-pre"))return ui;var i=V(t.value);i&&(t.setAttribute(":value",B(i)),t.value="")}var n,r=t.hasAttributes(),s=r&&d(t.attributes);return r&&(n=ci(t,s,e)),n||(n=hi(t,e)),n||(n=li(t,e)),!n&&r&&(n=pi(s,e)),n}function ii(t,e){if(t._skip)return ni;var i=V(t.wholeText);if(!i)return null;for(var n=t.nextSibling;n&&3===n.nodeType;)n._skip=!0,n=n.nextSibling;for(var r,s,o=document.createDocumentFragment(),a=0,h=i.length;a<h;a++)s=i[a],r=s.tag?ri(s,e):document.createTextNode(s.value),o.appendChild(r);return si(i,o,e)}function ni(t,e){nt(e)}function ri(t,e){function i(e){if(!t.descriptor){var i=I(t.value);t.descriptor={name:e,def:Ds[e],expression:i.expression,filters:i.filters}}}var n;return t.oneTime?n=document.createTextNode(t.value):t.html?(n=document.createComment("v-html"),i("html")):(n=document.createTextNode(" "),i("text")),n}function si(t,e){return function(i,n,r,o){for(var a,h,l,c=e.cloneNode(!0),u=d(c.childNodes),f=0,p=t.length;f<p;f++)a=t[f],h=a.value,a.tag&&(l=u[f],a.oneTime?(h=(o||i).$eval(h),a.html?st(l,ce(h,!0)):l.data=s(h)):i._bindDir(a.descriptor,l,r,o));st(n,c)}}function oi(t,e){for(var i,n,r,s=[],o=0,a=t.length;o<a;o++)r=t[o],i=ti(r,e),n=i&&i.terminal||"SCRIPT"===r.tagName||!r.hasChildNodes()?null:oi(r.childNodes,e),s.push(i,n);return s.length?ai(s):null}function ai(t){return function(e,i,n,r,s){for(var o,a,h,l=0,c=0,u=t.length;l<u;c++){o=i[c],a=t[l++],h=t[l++];var f=d(o.childNodes);a&&a(e,o,n,r,s),h&&h(e,f,n,r,s)}}}function hi(t,e){var i=t.tagName.toLowerCase();if(!zn.test(i)){var n=jt(e,"elementDirectives",i);return n?fi(t,i,"",e,n):void 0}}function li(t,e){var i=Ct(t,e);if(i){var n=gt(t),r={name:"component",ref:n,expression:i.id,def:Ys.component,modifiers:{literal:!i.dynamic}},s=function(t,e,i,s,o){n&&Lt((s||t).$refs,n,null),t._bindDir(r,e,i,s,o)};return s.terminal=!0,s}}function ci(t,e,i){if(null!==Y(t,"v-pre"))return ui;if(t.hasAttribute("v-else")){var n=t.previousElementSibling;if(n&&n.hasAttribute("v-if"))return ui}for(var r,s,o,a,h,l,c,u,f,p,d=0,v=e.length;d<v;d++)r=e[d],s=r.name.replace(io,""),(h=s.match(eo))&&(f=jt(i,"directives",h[1]),f&&f.terminal&&(!p||(f.priority||so)>p.priority)&&(p=f,c=r.name,a=di(r.name),o=r.value,l=h[1],u=h[2]));return p?fi(t,l,o,i,p,c,u,a):void 0}function ui(){}function fi(t,e,i,n,r,s,o,a){var h=I(i),l={name:e,arg:o,expression:h.expression,filters:h.filters,raw:i,attr:s,modifiers:a,def:r};"for"!==e&&"router-view"!==e||(l.ref=gt(t));var c=function(t,e,i,n,r){l.ref&&Lt((n||t).$refs,l.ref,null),t._bindDir(l,e,i,n,r)};return c.terminal=!0,c}function pi(t,e){function i(t,e,i){var n=i&&mi(i),r=!n&&I(s);v.push({name:t,attr:o,raw:a,def:e,arg:l,modifiers:c,expression:r&&r.expression,filters:r&&r.filters,interp:i,hasOneTime:n})}for(var n,r,s,o,a,h,l,c,u,f,p,d=t.length,v=[];d--;)if(n=t[d],r=o=n.name,s=a=n.value,f=V(s),l=null,c=di(r),r=r.replace(io,""),f)s=B(f),l=r,i("bind",Ds.bind,f);else if(no.test(r))c.literal=!Ks.test(r),i("transition",Ys.transition);else if(to.test(r))l=r.replace(to,""),i("on",Ds.on);else if(Ks.test(r))h=r.replace(Ks,""),"style"===h||"class"===h?i(h,Ys[h]):(l=h,i("bind",Ds.bind));else if(p=r.match(eo)){if(h=p[1],l=p[2],"else"===h)continue;u=jt(e,"directives",h,!0),u&&i(h,u)}if(v.length)return vi(v)}function di(t){var e=Object.create(null),i=t.match(io);if(i)for(var n=i.length;n--;)e[i[n].slice(1)]=!0;return e}function vi(t){return function(e,i,n,r,s){for(var o=t.length;o--;)e._bindDir(t[o],i,n,r,s)}}function mi(t){for(var e=t.length;e--;)if(t[e].oneTime)return!0}function gi(t){return"SCRIPT"===t.tagName&&(!t.hasAttribute("type")||"text/javascript"===t.getAttribute("type"))}function _i(t,e){return e&&(e._containerAttrs=bi(t)),vt(t)&&(t=ce(t)),e&&(e._asComponent&&!e.template&&(e.template="<slot></slot>"),e.template&&(e._content=ft(t),t=yi(t,e))),bt(t)&&(rt(mt("v-start",!0),t),t.appendChild(mt("v-end",!0))),t}function yi(t,e){var i=e.template,n=ce(i,!0);if(n){var r=n.firstChild;if(!r)return n;var s=r.tagName&&r.tagName.toLowerCase();return e.replace?(t===document.body,n.childNodes.length>1||1!==r.nodeType||"component"===s||jt(e,"components",s)||tt(r,"is")||jt(e,"elementDirectives",s)||r.hasAttribute("v-for")||r.hasAttribute("v-if")?n:(e._replacerAttrs=bi(r),wi(t,r),r)):(t.appendChild(n),t)}}function bi(t){if(1===t.nodeType&&t.hasAttributes())return d(t.attributes)}function wi(t,e){for(var i,n,r=t.attributes,s=r.length;s--;)i=r[s].name,n=r[s].value,e.hasAttribute(i)||oo.test(i)?"class"===i&&!V(n)&&(n=n.trim())&&n.split(/\s+/).forEach(function(t){ct(e,t)}):e.setAttribute(i,n)}function Ci(t,e){if(e){for(var i,n,r=t._slotContents=Object.create(null),s=0,o=e.children.length;s<o;s++)i=e.children[s],(n=i.getAttribute("slot"))&&(r[n]||(r[n]=[])).push(i);for(n in r)r[n]=$i(r[n],e);if(e.hasChildNodes()){var a=e.childNodes;if(1===a.length&&3===a[0].nodeType&&!a[0].data.trim())return;r.default=$i(e.childNodes,e)}}}function $i(t,e){var i=document.createDocumentFragment();t=d(t);for(var n=0,r=t.length;n<r;n++){var s=t[n];!vt(s)||s.hasAttribute("v-if")||s.hasAttribute("v-for")||(e.removeChild(s),s=ce(s,!0)),i.appendChild(s)}return i}function ki(t){function e(){}function n(t,e){var i=new re(e,t,null,{lazy:!0});return function(){return i.dirty&&i.evaluate(),Et.target&&i.depend(),i.value}}Object.defineProperty(t.prototype,"$data",{get:function(){return this._data},set:function(t){t!==this._data&&this._setData(t)}}),t.prototype._initState=function(){this._initProps(),this._initMeta(),this._initMethods(),this._initData(),this._initComputed()},t.prototype._initProps=function(){var t=this.$options,e=t.el,i=t.props;e=t.el=Z(e),this._propsUnlinkFn=e&&1===e.nodeType&&i?Ye(this,e,i,this._scope):null},t.prototype._initData=function(){var t=this.$options.data,e=this._data=t?t():{};g(e)||(e={});var n,r,s=this._props,o=Object.keys(e);for(n=o.length;n--;)r=o[n],s&&i(s,r)||this._proxy(r);Rt(e,this)},t.prototype._setData=function(t){t=t||{};var e=this._data;this._data=t;var n,r,s;for(n=Object.keys(e),s=n.length;s--;)r=n[s],r in t||this._unproxy(r);for(n=Object.keys(t),s=n.length;s--;)r=n[s],i(this,r)||this._proxy(r);e.__ob__.removeVm(this),Rt(t,this),this._digest()},t.prototype._proxy=function(t){if(!r(t)){var e=this;Object.defineProperty(e,t,{configurable:!0,enumerable:!0,get:function(){return e._data[t]},set:function(i){e._data[t]=i}})}},t.prototype._unproxy=function(t){r(t)||delete this[t]},t.prototype._digest=function(){for(var t=0,e=this._watchers.length;t<e;t++)this._watchers[t].update(!0)},t.prototype._initComputed=function(){var t=this.$options.computed;if(t)for(var i in t){var r=t[i],s={enumerable:!0,configurable:!0};"function"==typeof r?(s.get=n(r,this),s.set=e):(s.get=r.get?r.cache!==!1?n(r.get,this):p(r.get,this):e,s.set=r.set?p(r.set,this):e),Object.defineProperty(this,i,s)}},t.prototype._initMethods=function(){var t=this.$options.methods;if(t)for(var e in t)this[e]=p(t[e],this)},t.prototype._initMeta=function(){var t=this.$options._meta;if(t)for(var e in t)Lt(this,e,t[e])}}function xi(t){function e(t,e){for(var i,n,r,s=e.attributes,o=0,a=s.length;o<a;o++)i=s[o].name,ho.test(i)&&(i=i.replace(ho,""),n=s[o].value,Kt(n)&&(n+=".apply(this, $arguments)"),r=(t._scope||t._context).$eval(n,!0),r._fromParent=!0,t.$on(i.replace(ho),r))}function i(t,e,i){if(i){var r,s,o,a;for(s in i)if(r=i[s],qi(r))for(o=0,a=r.length;o<a;o++)n(t,e,s,r[o]);else n(t,e,s,r)}}function n(t,e,i,r,s){var o=typeof r;if("function"===o)t[e](i,r,s);else if("string"===o){var a=t.$options.methods,h=a&&a[r];h&&t[e](i,h,s)}else r&&"object"===o&&n(t,e,i,r.handler,r)}function r(){this._isAttached||(this._isAttached=!0,this.$children.forEach(s))}function s(t){!t._isAttached&&X(t.$el)&&t._callHook("attached")}function o(){this._isAttached&&(this._isAttached=!1,this.$children.forEach(a))}function a(t){t._isAttached&&!X(t.$el)&&t._callHook("detached")}t.prototype._initEvents=function(){var t=this.$options;t._asComponent&&e(this,t.el),i(this,"$on",t.events),i(this,"$watch",t.watch)},t.prototype._initDOMHooks=function(){this.$on("hook:attached",r),this.$on("hook:detached",o)},t.prototype._callHook=function(t){this.$emit("pre-hook:"+t);var e=this.$options[t];if(e)for(var i=0,n=e.length;i<n;i++)e[i].call(this);this.$emit("hook:"+t)}}function Ai(){}function Oi(t,e,i,n,r,s){this.vm=e,this.el=i,this.descriptor=t,this.name=t.name,this.expression=t.expression,this.arg=t.arg,this.modifiers=t.modifiers,this.filters=t.filters,this.literal=this.modifiers&&this.modifiers.literal,this._locked=!1,this._bound=!1,this._listeners=null,this._host=n,this._scope=r,this._frag=s}function Ti(t){t.prototype._updateRef=function(t){var e=this.$options._ref;if(e){var i=(this._scope||this._context).$refs;t?i[e]===this&&(i[e]=null):i[e]=this}},t.prototype._compile=function(t){var e=this.$options,i=t;if(t=_i(t,e),this._initElement(t),1!==t.nodeType||null===Y(t,"v-pre")){var n=this._context&&this._context.$options,r=Ke(t,e,n);Ci(this,e._content);var s,o=this.constructor;e._linkerCachable&&(s=o.linker,s||(s=o.linker=qe(t,e)));var a=r(this,t,this._scope),h=s?s(this,t):qe(t,e)(this,t);
this._unlinkFn=function(){a(),h(!0)},e.replace&&st(i,t),this._isCompiled=!0,this._callHook("compiled")}},t.prototype._initElement=function(t){bt(t)?(this._isFragment=!0,this.$el=this._fragmentStart=t.firstChild,this._fragmentEnd=t.lastChild,3===this._fragmentStart.nodeType&&(this._fragmentStart.data=this._fragmentEnd.data=""),this._fragment=t):this.$el=t,this.$el.__vue__=this,this._callHook("beforeCompile")},t.prototype._bindDir=function(t,e,i,n,r){this._directives.push(new Oi(t,this,e,i,n,r))},t.prototype._destroy=function(t,e){if(this._isBeingDestroyed)return void(e||this._cleanup());var i,n,r=this,s=function(){!i||n||e||r._cleanup()};t&&this.$el&&(n=!0,this.$remove(function(){n=!1,s()})),this._callHook("beforeDestroy"),this._isBeingDestroyed=!0;var o,a=this.$parent;for(a&&!a._isBeingDestroyed&&(a.$children.$remove(this),this._updateRef(!0)),o=this.$children.length;o--;)this.$children[o].$destroy();for(this._propsUnlinkFn&&this._propsUnlinkFn(),this._unlinkFn&&this._unlinkFn(),o=this._watchers.length;o--;)this._watchers[o].teardown();this.$el&&(this.$el.__vue__=null),i=!0,s()},t.prototype._cleanup=function(){this._isDestroyed||(this._frag&&this._frag.children.$remove(this),this._data&&this._data.__ob__&&this._data.__ob__.removeVm(this),this.$el=this.$parent=this.$root=this.$children=this._watchers=this._context=this._scope=this._directives=null,this._isDestroyed=!0,this._callHook("destroyed"),this.$off())}}function Ni(t){t.prototype._applyFilters=function(t,e,i,n){var r,s,o,a,h,l,c,u,f;for(l=0,c=i.length;l<c;l++)if(r=i[n?c-l-1:l],s=jt(this.$options,"filters",r.name,!0),s&&(s=n?s.write:s.read||s,"function"==typeof s)){if(o=n?[t,e]:[t],h=n?2:1,r.args)for(u=0,f=r.args.length;u<f;u++)a=r.args[u],o[u+h]=a.dynamic?this.$get(a.value):a.value;t=s.apply(this,o)}return t},t.prototype._resolveComponent=function(e,i){var n;if(n="function"==typeof e?e:jt(this.$options,"components",e,!0))if(n.options)i(n);else if(n.resolved)i(n.resolved);else if(n.requested)n.pendingCallbacks.push(i);else{n.requested=!0;var r=n.pendingCallbacks=[i];n.call(this,function(e){g(e)&&(e=t.extend(e)),n.resolved=e;for(var i=0,s=r.length;i<s;i++)r[i](e)},function(t){})}}}function ji(t){function i(t){return JSON.parse(JSON.stringify(t))}t.prototype.$get=function(t,e){var i=Yt(t);if(i){if(e){var n=this;return function(){n.$arguments=d(arguments);var t=i.get.call(n,n);return n.$arguments=null,t}}try{return i.get.call(this,this)}catch(t){}}},t.prototype.$set=function(t,e){var i=Yt(t,!0);i&&i.set&&i.set.call(this,this,e)},t.prototype.$delete=function(t){e(this._data,t)},t.prototype.$watch=function(t,e,i){var n,r=this;"string"==typeof t&&(n=I(t),t=n.expression);var s=new re(r,t,e,{deep:i&&i.deep,sync:i&&i.sync,filters:n&&n.filters,user:!i||i.user!==!1});return i&&i.immediate&&e.call(r,s.value),function(){s.teardown()}},t.prototype.$eval=function(t,e){if(lo.test(t)){var i=I(t),n=this.$get(i.expression,e);return i.filters?this._applyFilters(n,null,i.filters):n}return this.$get(t,e)},t.prototype.$interpolate=function(t){var e=V(t),i=this;return e?1===e.length?i.$eval(e[0].value)+"":e.map(function(t){return t.tag?i.$eval(t.value):t.value}).join(""):t},t.prototype.$log=function(t){var e=t?Bt(this._data,t):this._data;if(e&&(e=i(e)),!t){var n;for(n in this.$options.computed)e[n]=i(this[n]);if(this._props)for(n in this._props)e[n]=i(this[n])}console.log(e)}}function Ei(t){function e(t,e,n,r,s,o){e=i(e);var a=!X(e),h=r===!1||a?s:o,l=!a&&!t._isAttached&&!X(t.$el);return t._isFragment?(_t(t._fragmentStart,t._fragmentEnd,function(i){h(i,e,t)}),n&&n()):h(t.$el,e,t,n),l&&t._callHook("attached"),t}function i(t){return"string"==typeof t?document.querySelector(t):t}function n(t,e,i,n){e.appendChild(t),n&&n()}function r(t,e,i,n){et(t,e),n&&n()}function s(t,e,i){nt(t),i&&i()}t.prototype.$nextTick=function(t){ln(t,this)},t.prototype.$appendTo=function(t,i,r){return e(this,t,i,r,n,J)},t.prototype.$prependTo=function(t,e,n){return t=i(t),t.hasChildNodes()?this.$before(t.firstChild,e,n):this.$appendTo(t,e,n),this},t.prototype.$before=function(t,i,n){return e(this,t,i,n,r,q)},t.prototype.$after=function(t,e,n){return t=i(t),t.nextSibling?this.$before(t.nextSibling,e,n):this.$appendTo(t.parentNode,e,n),this},t.prototype.$remove=function(t,e){if(!this.$el.parentNode)return t&&t();var i=this._isAttached&&X(this.$el);i||(e=!1);var n=this,r=function(){i&&n._callHook("detached"),t&&t()};if(this._isFragment)yt(this._fragmentStart,this._fragmentEnd,this,this._fragment,r);else{var o=e===!1?s:Q;o(this.$el,this,r)}return this}}function Si(t){function e(t,e,n){var r=t.$parent;if(r&&n&&!i.test(e))for(;r;)r._eventsCount[e]=(r._eventsCount[e]||0)+n,r=r.$parent}t.prototype.$on=function(t,i){return(this._events[t]||(this._events[t]=[])).push(i),e(this,t,1),this},t.prototype.$once=function(t,e){function i(){n.$off(t,i),e.apply(this,arguments)}var n=this;return i.fn=e,this.$on(t,i),this},t.prototype.$off=function(t,i){var n;if(!arguments.length){if(this.$parent)for(t in this._events)n=this._events[t],n&&e(this,t,-n.length);return this._events={},this}if(n=this._events[t],!n)return this;if(1===arguments.length)return e(this,t,-n.length),this._events[t]=null,this;for(var r,s=n.length;s--;)if(r=n[s],r===i||r.fn===i){e(this,t,-1),n.splice(s,1);break}return this},t.prototype.$emit=function(t){var e="string"==typeof t;t=e?t:t.name;var i=this._events[t],n=e||!i;if(i){i=i.length>1?d(i):i;var r=e&&i.some(function(t){return t._fromParent});r&&(n=!1);for(var s=d(arguments,1),o=0,a=i.length;o<a;o++){var h=i[o],l=h.apply(this,s);l!==!0||r&&!h._fromParent||(n=!0)}}return n},t.prototype.$broadcast=function(t){var e="string"==typeof t;if(t=e?t:t.name,this._eventsCount[t]){var i=this.$children,n=d(arguments);e&&(n[0]={name:t,source:this});for(var r=0,s=i.length;r<s;r++){var o=i[r],a=o.$emit.apply(o,n);a&&o.$broadcast.apply(o,n)}return this}},t.prototype.$dispatch=function(t){var e=this.$emit.apply(this,arguments);if(e){var i=this.$parent,n=d(arguments);for(n[0]={name:t,source:this};i;)e=i.$emit.apply(i,n),i=e?i.$parent:null;return this}};var i=/^hook:/}function Fi(t){function e(){this._isAttached=!0,this._isReady=!0,this._callHook("ready")}t.prototype.$mount=function(t){if(!this._isCompiled)return t=Z(t),t||(t=document.createElement("div")),this._compile(t),this._initDOMHooks(),X(this.$el)?(this._callHook("attached"),e.call(this)):this.$once("hook:attached",e),this},t.prototype.$destroy=function(t,e){this._destroy(t,e)},t.prototype.$compile=function(t,e,i,n){return qe(t,this.$options,!0)(this,t,e,i,n)}}function Di(t){this._init(t)}function Pi(t,e,i){return i=i?parseInt(i,10):0,e=o(e),"number"==typeof e?t.slice(i,i+e):t}function Ri(t,e,i){if(t=po(t),null==e)return t;if("function"==typeof e)return t.filter(e);e=(""+e).toLowerCase();for(var n,r,s,o,a="in"===i?3:2,h=Array.prototype.concat.apply([],d(arguments,a)),l=[],c=0,u=t.length;c<u;c++)if(n=t[c],s=n&&n.$value||n,o=h.length){for(;o--;)if(r=h[o],"$key"===r&&Hi(n.$key,e)||Hi(Bt(s,r),e)){l.push(n);break}}else Hi(n,e)&&l.push(n);return l}function Li(t){function e(t,e,i){var r=n[i];return r&&("$key"!==r&&(m(t)&&"$value"in t&&(t=t.$value),m(e)&&"$value"in e&&(e=e.$value)),t=m(t)?Bt(t,r):t,e=m(e)?Bt(e,r):e),t===e?0:t>e?s:-s}var i=null,n=void 0;t=po(t);var r=d(arguments,1),s=r[r.length-1];"number"==typeof s?(s=s<0?-1:1,r=r.length>1?r.slice(0,-1):r):s=1;var o=r[0];return o?("function"==typeof o?i=function(t,e){return o(t,e)*s}:(n=Array.prototype.concat.apply([],r),i=function(t,r,s){return s=s||0,s>=n.length-1?e(t,r,s):e(t,r,s)||i(t,r,s+1)}),t.slice().sort(i)):t}function Hi(t,e){var i;if(g(t)){var n=Object.keys(t);for(i=n.length;i--;)if(Hi(t[n[i]],e))return!0}else if(qi(t)){for(i=t.length;i--;)if(Hi(t[i],e))return!0}else if(null!=t)return t.toString().toLowerCase().indexOf(e)>-1}function Ii(i){function n(t){return new Function("return function "+f(t)+" (options) { this._init(options) }")()}i.options={directives:Ds,elementDirectives:fo,filters:mo,transitions:{},components:{},partials:{},replace:!0},i.util=Kn,i.config=Mn,i.set=t,i.delete=e,i.nextTick=ln,i.compiler=ao,i.FragmentFactory=_e,i.internalDirectives=Ys,i.parsers={path:mr,text:Ln,template:qr,directive:En,expression:jr},i.cid=0;var r=1;i.extend=function(t){t=t||{};var e=this,i=0===e.cid;if(i&&t._Ctor)return t._Ctor;var s=t.name||e.options.name,o=n(s||"VueComponent");return o.prototype=Object.create(e.prototype),o.prototype.constructor=o,o.cid=r++,o.options=Nt(e.options,t),o.super=e,o.extend=e.extend,Mn._assetTypes.forEach(function(t){o[t]=e[t]}),s&&(o.options.components[s]=o),i&&(t._Ctor=o),o},i.use=function(t){if(!t.installed){var e=d(arguments,1);return e.unshift(this),"function"==typeof t.install?t.install.apply(t,e):t.apply(null,e),t.installed=!0,this}},i.mixin=function(t){i.options=Nt(i.options,t)},Mn._assetTypes.forEach(function(t){i[t]=function(e,n){return n?("component"===t&&g(n)&&(n.name||(n.name=e),n=i.extend(n)),this.options[t+"s"][e]=n,n):this.options[t+"s"][e]}}),v(i.transition,Vn)}var Mi=Object.prototype.hasOwnProperty,Wi=/^\s?(true|false|-?[\d\.]+|'[^']*'|"[^"]*")\s?$/,Vi=/-(\w)/g,Bi=/([^-])([A-Z])/g,zi=/(?:^|[-_\/])(\w)/g,Ui=Object.prototype.toString,Ji="[object Object]",qi=Array.isArray,Qi="__proto__"in{},Gi="undefined"!=typeof window&&"[object Object]"!==Object.prototype.toString.call(window),Zi=Gi&&window.__VUE_DEVTOOLS_GLOBAL_HOOK__,Xi=Gi&&window.navigator.userAgent.toLowerCase(),Yi=Xi&&Xi.indexOf("trident")>0,Ki=Xi&&Xi.indexOf("msie 9.0")>0,tn=Xi&&Xi.indexOf("android")>0,en=Xi&&/iphone|ipad|ipod|ios/.test(Xi),nn=void 0,rn=void 0,sn=void 0,on=void 0;if(Gi&&!Ki){var an=void 0===window.ontransitionend&&void 0!==window.onwebkittransitionend,hn=void 0===window.onanimationend&&void 0!==window.onwebkitanimationend;nn=an?"WebkitTransition":"transition",rn=an?"webkitTransitionEnd":"transitionend",sn=hn?"WebkitAnimation":"animation",on=hn?"webkitAnimationEnd":"animationend"}var ln=function(){function t(){i=!1;var t=e.slice(0);e.length=0;for(var n=0;n<t.length;n++)t[n]()}var e=[],i=!1,n=void 0;if("undefined"!=typeof Promise&&$(Promise)){var r=Promise.resolve(),s=function(){};n=function(){r.then(t),en&&setTimeout(s)}}else if("undefined"!=typeof MutationObserver){var o=1,a=new MutationObserver(t),h=document.createTextNode(String(o));a.observe(h,{characterData:!0}),n=function(){o=(o+1)%2,h.data=String(o)}}else n=setTimeout;return function(r,s){var o=s?function(){r.call(s)}:r;e.push(o),i||(i=!0,n(t,0))}}(),cn=void 0;"undefined"!=typeof Set&&$(Set)?cn=Set:(cn=function(){this.set=Object.create(null)},cn.prototype.has=function(t){return void 0!==this.set[t]},cn.prototype.add=function(t){this.set[t]=1},cn.prototype.clear=function(){this.set=Object.create(null)});var un=k.prototype;un.put=function(t,e){var i,n=this.get(t,!0);return n||(this.size===this.limit&&(i=this.shift()),n={key:t},this._keymap[t]=n,this.tail?(this.tail.newer=n,n.older=this.tail):this.head=n,this.tail=n,this.size++),n.value=e,i},un.shift=function(){var t=this.head;return t&&(this.head=this.head.newer,this.head.older=void 0,t.newer=t.older=void 0,this._keymap[t.key]=void 0,this.size--),t},un.get=function(t,e){var i=this._keymap[t];if(void 0!==i)return i===this.tail?e?i:i.value:(i.newer&&(i===this.head&&(this.head=i.newer),i.newer.older=i.older),i.older&&(i.older.newer=i.newer),i.newer=void 0,i.older=this.tail,this.tail&&(this.tail.newer=i),this.tail=i,e?i:i.value)};var fn,pn,dn,vn,mn,gn,_n=new k(1e3),yn=/^in$|^-?\d+/,bn=0,wn=1,Cn=2,$n=3,kn=34,xn=39,An=124,On=92,Tn=32,Nn={91:1,123:1,40:1},jn={91:93,123:125,40:41},En=Object.freeze({parseDirective:I}),Sn=/[-.*+?^${}()|[\]\/\\]/g,Fn=void 0,Dn=void 0,Pn=void 0,Rn=/[^|]\|[^|]/,Ln=Object.freeze({compileRegex:W,parseText:V,tokensToExp:B}),Hn=["{{","}}"],In=["{{{","}}}"],Mn=Object.defineProperties({debug:!1,silent:!1,async:!0,warnExpressionErrors:!0,devtools:!1,_delimitersChanged:!0,_assetTypes:["component","directive","elementDirective","filter","transition","partial"],_propBindingModes:{ONE_WAY:0,TWO_WAY:1,ONE_TIME:2},_maxUpdateCount:100},{delimiters:{get:function(){return Hn},set:function(t){Hn=t,W()},configurable:!0,enumerable:!0},unsafeDelimiters:{get:function(){return In},set:function(t){In=t,W()},configurable:!0,enumerable:!0}}),Wn=void 0,Vn=Object.freeze({appendWithTransition:J,beforeWithTransition:q,removeWithTransition:Q,applyTransition:G}),Bn=/^v-ref:/,zn=/^(div|p|span|img|a|b|i|br|ul|ol|li|h1|h2|h3|h4|h5|h6|code|pre|table|th|td|tr|form|label|input|select|option|nav|article|section|header|footer)$/i,Un=/^(slot|partial|component)$/i,Jn=Mn.optionMergeStrategies=Object.create(null);Jn.data=function(t,e,i){return i?t||e?function(){var n="function"==typeof e?e.call(i):e,r="function"==typeof t?t.call(i):void 0;return n?kt(n,r):r}:void 0:e?"function"!=typeof e?t:t?function(){return kt(e.call(this),t.call(this))}:e:t},Jn.el=function(t,e,i){if(i||!e||"function"==typeof e){var n=e||t;return i&&"function"==typeof n?n.call(i):n}},Jn.init=Jn.created=Jn.ready=Jn.attached=Jn.detached=Jn.beforeCompile=Jn.compiled=Jn.beforeDestroy=Jn.destroyed=Jn.activate=function(t,e){return e?t?t.concat(e):qi(e)?e:[e]:t},Mn._assetTypes.forEach(function(t){Jn[t+"s"]=xt}),Jn.watch=Jn.events=function(t,e){if(!e)return t;if(!t)return e;var i={};v(i,t);for(var n in e){var r=i[n],s=e[n];r&&!qi(r)&&(r=[r]),i[n]=r?r.concat(s):[s]}return i},Jn.props=Jn.methods=Jn.computed=function(t,e){if(!e)return t;if(!t)return e;var i=Object.create(null);return v(i,t),v(i,e),i};var qn=function(t,e){return void 0===e?t:e},Qn=0;Et.target=null,Et.prototype.addSub=function(t){this.subs.push(t)},Et.prototype.removeSub=function(t){this.subs.$remove(t)},Et.prototype.depend=function(){Et.target.addDep(this)},Et.prototype.notify=function(){for(var t=d(this.subs),e=0,i=t.length;e<i;e++)t[e].update()};var Gn=Array.prototype,Zn=Object.create(Gn);["push","pop","shift","unshift","splice","sort","reverse"].forEach(function(t){var e=Gn[t];_(Zn,t,function(){for(var i=arguments.length,n=new Array(i);i--;)n[i]=arguments[i];var r,s=e.apply(this,n),o=this.__ob__;switch(t){case"push":r=n;break;case"unshift":r=n;break;case"splice":r=n.slice(2)}return r&&o.observeArray(r),o.dep.notify(),s})}),_(Gn,"$set",function(t,e){return t>=this.length&&(this.length=Number(t)+1),this.splice(t,1,e)[0]}),_(Gn,"$remove",function(t){if(this.length){var e=b(this,t);return e>-1?this.splice(e,1):void 0}});var Xn=Object.getOwnPropertyNames(Zn),Yn=!0;Ft.prototype.walk=function(t){for(var e=Object.keys(t),i=0,n=e.length;i<n;i++)this.convert(e[i],t[e[i]])},Ft.prototype.observeArray=function(t){for(var e=0,i=t.length;e<i;e++)Rt(t[e])},Ft.prototype.convert=function(t,e){Lt(this.value,t,e)},Ft.prototype.addVm=function(t){(this.vms||(this.vms=[])).push(t)},Ft.prototype.removeVm=function(t){this.vms.$remove(t)};var Kn=Object.freeze({defineReactive:Lt,set:t,del:e,hasOwn:i,isLiteral:n,isReserved:r,_toString:s,toNumber:o,toBoolean:a,stripQuotes:h,camelize:l,hyphenate:u,classify:f,bind:p,toArray:d,extend:v,isObject:m,isPlainObject:g,def:_,debounce:y,indexOf:b,cancellable:w,looseEqual:C,isArray:qi,hasProto:Qi,inBrowser:Gi,devtools:Zi,isIE:Yi,isIE9:Ki,isAndroid:tn,isIOS:en,get transitionProp(){return nn},get transitionEndEvent(){return rn},get animationProp(){return sn},get animationEndEvent(){return on},nextTick:ln,get _Set(){return cn},query:Z,inDoc:X,getAttr:Y,getBindAttr:K,hasBindAttr:tt,before:et,after:it,remove:nt,prepend:rt,replace:st,on:ot,off:at,setClass:lt,addClass:ct,removeClass:ut,extractContent:ft,trimNode:pt,isTemplate:vt,createAnchor:mt,findRef:gt,mapNodeRange:_t,removeNodeRange:yt,isFragment:bt,getOuterHTML:wt,mergeOptions:Nt,resolveAsset:jt,checkComponentAttr:Ct,commonTagRE:zn,reservedTagRE:Un,warn:Wn}),tr=0,er=new k(1e3),ir=0,nr=1,rr=2,sr=3,or=0,ar=1,hr=2,lr=3,cr=4,ur=5,fr=6,pr=7,dr=8,vr=[];vr[or]={ws:[or],ident:[lr,ir],"[":[cr],eof:[pr]},vr[ar]={ws:[ar],".":[hr],"[":[cr],eof:[pr]},vr[hr]={ws:[hr],ident:[lr,ir]},vr[lr]={ident:[lr,ir],0:[lr,ir],number:[lr,ir],ws:[ar,nr],".":[hr,nr],"[":[cr,nr],eof:[pr,nr]},vr[cr]={"'":[ur,ir],'"':[fr,ir],"[":[cr,rr],"]":[ar,sr],eof:dr,else:[cr,ir]},vr[ur]={"'":[cr,ir],eof:dr,else:[ur,ir]},vr[fr]={'"':[cr,ir],eof:dr,else:[fr,ir]};var mr=Object.freeze({parsePath:Vt,getPath:Bt,setPath:zt}),gr=new k(1e3),_r="Math,Date,this,true,false,null,undefined,Infinity,NaN,isNaN,isFinite,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,parseInt,parseFloat",yr=new RegExp("^("+_r.replace(/,/g,"\\b|")+"\\b)"),br="break,case,class,catch,const,continue,debugger,default,delete,do,else,export,extends,finally,for,function,if,import,in,instanceof,let,return,super,switch,throw,try,var,while,with,yield,enum,await,implements,package,protected,static,interface,private,public",wr=new RegExp("^("+br.replace(/,/g,"\\b|")+"\\b)"),Cr=/\s/g,$r=/\n/g,kr=/[\{,]\s*[\w\$_]+\s*:|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\"']|\\.)*`|`(?:[^`\\]|\\.)*`)|new |typeof |void /g,xr=/"(\d+)"/g,Ar=/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/,Or=/[^\w$\.](?:[A-Za-z_$][\w$]*)/g,Tr=/^(?:true|false|null|undefined|Infinity|NaN)$/,Nr=[],jr=Object.freeze({parseExpression:Yt,isSimplePath:Kt}),Er=[],Sr=[],Fr={},Dr={},Pr=!1,Rr=0;re.prototype.get=function(){this.beforeGet();var t,e=this.scope||this.vm;try{t=this.getter.call(e,e)}catch(t){}return this.deep&&se(t),this.preProcess&&(t=this.preProcess(t)),this.filters&&(t=e._applyFilters(t,null,this.filters,!1)),this.postProcess&&(t=this.postProcess(t)),this.afterGet(),t},re.prototype.set=function(t){var e=this.scope||this.vm;this.filters&&(t=e._applyFilters(t,this.value,this.filters,!0));try{this.setter.call(e,e,t)}catch(t){}var i=e.$forContext;if(i&&i.alias===this.expression){if(i.filters)return;i._withLock(function(){e.$key?i.rawValue[e.$key]=t:i.rawValue.$set(e.$index,t)})}},re.prototype.beforeGet=function(){Et.target=this},re.prototype.addDep=function(t){var e=t.id;this.newDepIds.has(e)||(this.newDepIds.add(e),this.newDeps.push(t),this.depIds.has(e)||t.addSub(this))},re.prototype.afterGet=function(){Et.target=null;for(var t=this.deps.length;t--;){var e=this.deps[t];this.newDepIds.has(e.id)||e.removeSub(this)}var i=this.depIds;this.depIds=this.newDepIds,this.newDepIds=i,this.newDepIds.clear(),i=this.deps,this.deps=this.newDeps,this.newDeps=i,this.newDeps.length=0},re.prototype.update=function(t){this.lazy?this.dirty=!0:this.sync||!Mn.async?this.run():(this.shallow=this.queued?!!t&&this.shallow:!!t,this.queued=!0,ne(this))},re.prototype.run=function(){if(this.active){var t=this.get();if(t!==this.value||(m(t)||this.deep)&&!this.shallow){var e=this.value;this.value=t;this.prevError;this.cb.call(this.vm,t,e)}this.queued=this.shallow=!1}},re.prototype.evaluate=function(){var t=Et.target;this.value=this.get(),this.dirty=!1,Et.target=t},re.prototype.depend=function(){for(var t=this.deps.length;t--;)this.deps[t].depend()},re.prototype.teardown=function(){if(this.active){this.vm._isBeingDestroyed||this.vm._vForRemoving||this.vm._watchers.$remove(this);for(var t=this.deps.length;t--;)this.deps[t].removeSub(this);this.active=!1,this.vm=this.cb=this.value=null}};var Lr=new cn,Hr={bind:function(){this.attr=3===this.el.nodeType?"data":"textContent"},update:function(t){this.el[this.attr]=s(t)}},Ir=new k(1e3),Mr=new k(1e3),Wr={efault:[0,"",""],legend:[1,"<fieldset>","</fieldset>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"]};Wr.td=Wr.th=[3,"<table><tbody><tr>","</tr></tbody></table>"],Wr.option=Wr.optgroup=[1,'<select multiple="multiple">',"</select>"],Wr.thead=Wr.tbody=Wr.colgroup=Wr.caption=Wr.tfoot=[1,"<table>","</table>"],Wr.g=Wr.defs=Wr.symbol=Wr.use=Wr.image=Wr.text=Wr.circle=Wr.ellipse=Wr.line=Wr.path=Wr.polygon=Wr.polyline=Wr.rect=[1,'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ev="http://www.w3.org/2001/xml-events"version="1.1">',"</svg>"];var Vr=/<([\w:-]+)/,Br=/&#?\w+?;/,zr=/<!--/,Ur=function(){if(Gi){var t=document.createElement("div");return t.innerHTML="<template>1</template>",!t.cloneNode(!0).firstChild.innerHTML}return!1}(),Jr=function(){if(Gi){var t=document.createElement("textarea");return t.placeholder="t","t"===t.cloneNode(!0).value}return!1}(),qr=Object.freeze({cloneNode:le,parseTemplate:ce}),Qr={bind:function(){8===this.el.nodeType&&(this.nodes=[],this.anchor=mt("v-html"),st(this.el,this.anchor))},update:function(t){t=s(t),this.nodes?this.swap(t):this.el.innerHTML=t},swap:function(t){for(var e=this.nodes.length;e--;)nt(this.nodes[e]);var i=ce(t,!0,!0);this.nodes=d(i.childNodes),et(i,this.anchor)}};ue.prototype.callHook=function(t){var e,i;for(e=0,i=this.childFrags.length;e<i;e++)this.childFrags[e].callHook(t);for(e=0,i=this.children.length;e<i;e++)t(this.children[e])},ue.prototype.beforeRemove=function(){var t,e;for(t=0,e=this.childFrags.length;t<e;t++)this.childFrags[t].beforeRemove(!1);for(t=0,e=this.children.length;t<e;t++)this.children[t].$destroy(!1,!0);var i=this.unlink.dirs;for(t=0,e=i.length;t<e;t++)i[t]._watcher&&i[t]._watcher.teardown()},ue.prototype.destroy=function(){this.parentFrag&&this.parentFrag.childFrags.$remove(this),this.node.__v_frag=null,this.unlink()};var Gr=new k(5e3);_e.prototype.create=function(t,e,i){var n=le(this.template);return new ue(this.linker,this.vm,n,t,e,i)};var Zr=700,Xr=800,Yr=850,Kr=1100,ts=1500,es=1500,is=1750,ns=2100,rs=2200,ss=2300,os=0,as={priority:rs,terminal:!0,params:["track-by","stagger","enter-stagger","leave-stagger"],bind:function(){var t=this.expression.match(/(.*) (?:in|of) (.*)/);if(t){var e=t[1].match(/\((.*),(.*)\)/);e?(this.iterator=e[1].trim(),this.alias=e[2].trim()):this.alias=t[1].trim(),this.expression=t[2]}if(this.alias){this.id="__v-for__"+ ++os;var i=this.el.tagName;this.isOption=("OPTION"===i||"OPTGROUP"===i)&&"SELECT"===this.el.parentNode.tagName,this.start=mt("v-for-start"),this.end=mt("v-for-end"),st(this.el,this.end),et(this.start,this.end),this.cache=Object.create(null),this.factory=new _e(this.vm,this.el)}},update:function(t){this.diff(t),this.updateRef(),this.updateModel()},diff:function(t){var e,n,r,s,o,a,h=t[0],l=this.fromObject=m(h)&&i(h,"$key")&&i(h,"$value"),c=this.params.trackBy,u=this.frags,f=this.frags=new Array(t.length),p=this.alias,d=this.iterator,v=this.start,g=this.end,_=X(v),y=!u;for(e=0,n=t.length;e<n;e++)h=t[e],s=l?h.$key:null,o=l?h.$value:h,a=!m(o),r=!y&&this.getCachedFrag(o,e,s),r?(r.reused=!0,r.scope.$index=e,s&&(r.scope.$key=s),d&&(r.scope[d]=null!==s?s:e),(c||l||a)&&St(function(){r.scope[p]=o})):(r=this.create(o,p,e,s),r.fresh=!y),f[e]=r,y&&r.before(g);if(!y){var b=0,w=u.length-f.length;for(this.vm._vForRemoving=!0,e=0,n=u.length;e<n;e++)r=u[e],r.reused||(this.deleteCachedFrag(r),this.remove(r,b++,w,_));this.vm._vForRemoving=!1,b&&(this.vm._watchers=this.vm._watchers.filter(function(t){return t.active}));var C,$,k,x=0;for(e=0,n=f.length;e<n;e++)r=f[e],C=f[e-1],$=C?C.staggerCb?C.staggerAnchor:C.end||C.node:v,r.reused&&!r.staggerCb?(k=ye(r,v,this.id),k===C||k&&ye(k,v,this.id)===C||this.move(r,$)):this.insert(r,x++,$,_),r.reused=r.fresh=!1}},create:function(t,e,i,n){var r=this._host,s=this._scope||this.vm,o=Object.create(s);o.$refs=Object.create(s.$refs),o.$els=Object.create(s.$els),o.$parent=s,o.$forContext=this,St(function(){Lt(o,e,t)}),Lt(o,"$index",i),n?Lt(o,"$key",n):o.$key&&_(o,"$key",null),this.iterator&&Lt(o,this.iterator,null!==n?n:i);var a=this.factory.create(r,o,this._frag);return a.forId=this.id,this.cacheFrag(t,a,i,n),a},updateRef:function(){var t=this.descriptor.ref;if(t){var e,i=(this._scope||this.vm).$refs;this.fromObject?(e={},this.frags.forEach(function(t){e[t.scope.$key]=Ce(t)})):e=this.frags.map(Ce),i[t]=e}},updateModel:function(){if(this.isOption){var t=this.start.parentNode,e=t&&t.__v_model;e&&e.forceUpdate()}},insert:function(t,e,i,n){t.staggerCb&&(t.staggerCb.cancel(),t.staggerCb=null);var r=this.getStagger(t,e,null,"enter");if(n&&r){var s=t.staggerAnchor;s||(s=t.staggerAnchor=mt("stagger-anchor"),s.__v_frag=t),it(s,i);var o=t.staggerCb=w(function(){t.staggerCb=null,t.before(s),nt(s)});setTimeout(o,r)}else{var a=i.nextSibling;a||(it(this.end,i),a=this.end),t.before(a)}},remove:function(t,e,i,n){if(t.staggerCb)return t.staggerCb.cancel(),void(t.staggerCb=null);var r=this.getStagger(t,e,i,"leave");if(n&&r){var s=t.staggerCb=w(function(){t.staggerCb=null,t.remove()});setTimeout(s,r)}else t.remove()},move:function(t,e){e.nextSibling||this.end.parentNode.appendChild(this.end),t.before(e.nextSibling,!1)},cacheFrag:function(t,e,n,r){var s,o=this.params.trackBy,a=this.cache,h=!m(t);r||o||h?(s=we(n,r,t,o),a[s]||(a[s]=e)):(s=this.id,i(t,s)?null===t[s]&&(t[s]=e):Object.isExtensible(t)&&_(t,s,e)),e.raw=t},getCachedFrag:function(t,e,i){var n,r=this.params.trackBy,s=!m(t);if(i||r||s){var o=we(e,i,t,r);n=this.cache[o]}else n=t[this.id];return n&&(n.reused||n.fresh),n},deleteCachedFrag:function(t){var e=t.raw,n=this.params.trackBy,r=t.scope,s=r.$index,o=i(r,"$key")&&r.$key,a=!m(e);if(n||o||a){var h=we(s,o,e,n);this.cache[h]=null}else e[this.id]=null,t.raw=null},getStagger:function(t,e,i,n){n+="Stagger";var r=t.node.__v_trans,s=r&&r.hooks,o=s&&(s[n]||s.stagger);return o?o.call(t,e,i):e*parseInt(this.params[n]||this.params.stagger,10)},_preProcess:function(t){return this.rawValue=t,t},_postProcess:function(t){if(qi(t))return t;if(g(t)){for(var e,i=Object.keys(t),n=i.length,r=new Array(n);n--;)e=i[n],r[n]={$key:e,$value:t[e]};return r}return"number"!=typeof t||isNaN(t)||(t=be(t)),t||[]},unbind:function(){if(this.descriptor.ref&&((this._scope||this.vm).$refs[this.descriptor.ref]=null),this.frags)for(var t,e=this.frags.length;e--;)t=this.frags[e],this.deleteCachedFrag(t),t.destroy()}},hs={priority:ns,terminal:!0,bind:function(){var t=this.el;if(t.__vue__)this.invalid=!0;else{var e=t.nextElementSibling;e&&null!==Y(e,"v-else")&&(nt(e),this.elseEl=e),this.anchor=mt("v-if"),st(t,this.anchor)}},update:function(t){this.invalid||(t?this.frag||this.insert():this.remove())},insert:function(){this.elseFrag&&(this.elseFrag.remove(),this.elseFrag=null),this.factory||(this.factory=new _e(this.vm,this.el)),this.frag=this.factory.create(this._host,this._scope,this._frag),this.frag.before(this.anchor)},remove:function(){this.frag&&(this.frag.remove(),this.frag=null),this.elseEl&&!this.elseFrag&&(this.elseFactory||(this.elseFactory=new _e(this.elseEl._context||this.vm,this.elseEl)),this.elseFrag=this.elseFactory.create(this._host,this._scope,this._frag),this.elseFrag.before(this.anchor))},unbind:function(){this.frag&&this.frag.destroy(),this.elseFrag&&this.elseFrag.destroy()}},ls={bind:function(){var t=this.el.nextElementSibling;t&&null!==Y(t,"v-else")&&(this.elseEl=t)},update:function(t){this.apply(this.el,t),this.elseEl&&this.apply(this.elseEl,!t)},apply:function(t,e){function i(){t.style.display=e?"":"none"}X(t)?G(t,e?1:-1,i,this.vm):i()}},cs={bind:function(){var t=this,e=this.el,i="range"===e.type,n=this.params.lazy,r=this.params.number,s=this.params.debounce,a=!1;if(tn||i||(this.on("compositionstart",function(){a=!0}),this.on("compositionend",function(){a=!1,n||t.listener()})),this.focused=!1,i||n||(this.on("focus",function(){t.focused=!0}),this.on("blur",function(){t.focused=!1,t._frag&&!t._frag.inserted||t.rawListener()})),this.listener=this.rawListener=function(){if(!a&&t._bound){var n=r||i?o(e.value):e.value;t.set(n),ln(function(){t._bound&&!t.focused&&t.update(t._watcher.value)})}},s&&(this.listener=y(this.listener,s)),this.hasjQuery="function"==typeof jQuery,this.hasjQuery){var h=jQuery.fn.on?"on":"bind";jQuery(e)[h]("change",this.rawListener),n||jQuery(e)[h]("input",this.listener)}else this.on("change",this.rawListener),n||this.on("input",this.listener);!n&&Ki&&(this.on("cut",function(){ln(t.listener)}),this.on("keyup",function(e){46!==e.keyCode&&8!==e.keyCode||t.listener()})),(e.hasAttribute("value")||"TEXTAREA"===e.tagName&&e.value.trim())&&(this.afterBind=this.listener)},update:function(t){t=s(t),t!==this.el.value&&(this.el.value=t)},unbind:function(){var t=this.el;if(this.hasjQuery){var e=jQuery.fn.off?"off":"unbind";jQuery(t)[e]("change",this.listener),jQuery(t)[e]("input",this.listener)}}},us={bind:function(){var t=this,e=this.el;this.getValue=function(){if(e.hasOwnProperty("_value"))return e._value;var i=e.value;return t.params.number&&(i=o(i)),i},this.listener=function(){t.set(t.getValue())},this.on("change",this.listener),e.hasAttribute("checked")&&(this.afterBind=this.listener)},update:function(t){this.el.checked=C(t,this.getValue())}},fs={bind:function(){var t=this,e=this,i=this.el;this.forceUpdate=function(){e._watcher&&e.update(e._watcher.get())};var n=this.multiple=i.hasAttribute("multiple");this.listener=function(){var t=$e(i,n);t=e.params.number?qi(t)?t.map(o):o(t):t,e.set(t)},this.on("change",this.listener);var r=$e(i,n,!0);(n&&r.length||!n&&null!==r)&&(this.afterBind=this.listener),this.vm.$on("hook:attached",function(){ln(t.forceUpdate)}),X(i)||ln(this.forceUpdate)},update:function(t){var e=this.el;e.selectedIndex=-1;for(var i,n,r=this.multiple&&qi(t),s=e.options,o=s.length;o--;)i=s[o],n=i.hasOwnProperty("_value")?i._value:i.value,i.selected=r?ke(t,n)>-1:C(t,n)},unbind:function(){this.vm.$off("hook:attached",this.forceUpdate)}},ps={bind:function(){function t(){var t=i.checked;return t&&i.hasOwnProperty("_trueValue")?i._trueValue:!t&&i.hasOwnProperty("_falseValue")?i._falseValue:t}var e=this,i=this.el;this.getValue=function(){return i.hasOwnProperty("_value")?i._value:e.params.number?o(i.value):i.value},this.listener=function(){var n=e._watcher.get();if(qi(n)){var r=e.getValue(),s=b(n,r);i.checked?s<0&&e.set(n.concat(r)):s>-1&&e.set(n.slice(0,s).concat(n.slice(s+1)))}else e.set(t())},this.on("change",this.listener),i.hasAttribute("checked")&&(this.afterBind=this.listener)},update:function(t){var e=this.el;qi(t)?e.checked=b(t,this.getValue())>-1:e.hasOwnProperty("_trueValue")?e.checked=C(t,e._trueValue):e.checked=!!t}},ds={text:cs,radio:us,select:fs,checkbox:ps},vs={priority:Xr,twoWay:!0,handlers:ds,params:["lazy","number","debounce"],bind:function(){this.checkFilters(),this.hasRead&&!this.hasWrite;var t,e=this.el,i=e.tagName;if("INPUT"===i)t=ds[e.type]||ds.text;else if("SELECT"===i)t=ds.select;else{if("TEXTAREA"!==i)return;t=ds.text}e.__v_model=this,t.bind.call(this),this.update=t.update,this._unbind=t.unbind},checkFilters:function(){var t=this.filters;if(t)for(var e=t.length;e--;){var i=jt(this.vm.$options,"filters",t[e].name);("function"==typeof i||i.read)&&(this.hasRead=!0),i.write&&(this.hasWrite=!0)}},unbind:function(){this.el.__v_model=null,this._unbind&&this._unbind()}},ms={esc:27,tab:9,enter:13,space:32,delete:[8,46],up:38,left:37,right:39,down:40},gs={priority:Zr,acceptStatement:!0,keyCodes:ms,bind:function(){if("IFRAME"===this.el.tagName&&"load"!==this.arg){var t=this;this.iframeBind=function(){ot(t.el.contentWindow,t.arg,t.handler,t.modifiers.capture)},this.on("load",this.iframeBind)}},update:function(t){if(this.descriptor.raw||(t=function(){}),"function"==typeof t){this.modifiers.stop&&(t=Ae(t)),this.modifiers.prevent&&(t=Oe(t)),this.modifiers.self&&(t=Te(t));var e=Object.keys(this.modifiers).filter(function(t){return"stop"!==t&&"prevent"!==t&&"self"!==t&&"capture"!==t});e.length&&(t=xe(t,e)),this.reset(),this.handler=t,this.iframeBind?this.iframeBind():ot(this.el,this.arg,this.handler,this.modifiers.capture)}},reset:function(){var t=this.iframeBind?this.el.contentWindow:this.el;this.handler&&at(t,this.arg,this.handler)},unbind:function(){this.reset()}},_s=["-webkit-","-moz-","-ms-"],ys=["Webkit","Moz","ms"],bs=/!important;?$/,ws=Object.create(null),Cs=null,$s={deep:!0,update:function(t){"string"==typeof t?this.el.style.cssText=t:qi(t)?this.handleObject(t.reduce(v,{})):this.handleObject(t||{})},handleObject:function(t){var e,i,n=this.cache||(this.cache={});for(e in n)e in t||(this.handleSingle(e,null),delete n[e]);for(e in t)i=t[e],i!==n[e]&&(n[e]=i,this.handleSingle(e,i))},handleSingle:function(t,e){if(t=Ne(t))if(null!=e&&(e+=""),e){var i=bs.test(e)?"important":"";i?(e=e.replace(bs,"").trim(),this.el.style.setProperty(t.kebab,e,i)):this.el.style[t.camel]=e;
}else this.el.style[t.camel]=""}},ks="http://www.w3.org/1999/xlink",xs=/^xlink:/,As=/^v-|^:|^@|^(?:is|transition|transition-mode|debounce|track-by|stagger|enter-stagger|leave-stagger)$/,Os=/^(?:value|checked|selected|muted)$/,Ts=/^(?:draggable|contenteditable|spellcheck)$/,Ns={value:"_value","true-value":"_trueValue","false-value":"_falseValue"},js={priority:Yr,bind:function(){var t=this.arg,e=this.el.tagName;t||(this.deep=!0);var i=this.descriptor,n=i.interp;n&&(i.hasOneTime&&(this.expression=B(n,this._scope||this.vm)),(As.test(t)||"name"===t&&("PARTIAL"===e||"SLOT"===e))&&(this.el.removeAttribute(t),this.invalid=!0))},update:function(t){if(!this.invalid){var e=this.arg;this.arg?this.handleSingle(e,t):this.handleObject(t||{})}},handleObject:$s.handleObject,handleSingle:function(t,e){var i=this.el,n=this.descriptor.interp;if(this.modifiers.camel&&(t=l(t)),!n&&Os.test(t)&&t in i){var r="value"===t&&null==e?"":e;i[t]!==r&&(i[t]=r)}var s=Ns[t];if(!n&&s){i[s]=e;var o=i.__v_model;o&&o.listener()}return"value"===t&&"TEXTAREA"===i.tagName?void i.removeAttribute(t):void(Ts.test(t)?i.setAttribute(t,e?"true":"false"):null!=e&&e!==!1?"class"===t?(i.__v_trans&&(e+=" "+i.__v_trans.id+"-transition"),lt(i,e)):xs.test(t)?i.setAttributeNS(ks,t,e===!0?"":e):i.setAttribute(t,e===!0?"":e):i.removeAttribute(t))}},Es={priority:ts,bind:function(){if(this.arg){var t=this.id=l(this.arg),e=(this._scope||this.vm).$els;i(e,t)?e[t]=this.el:Lt(e,t,this.el)}},unbind:function(){var t=(this._scope||this.vm).$els;t[this.id]===this.el&&(t[this.id]=null)}},Ss={bind:function(){}},Fs={bind:function(){var t=this.el;this.vm.$once("pre-hook:compiled",function(){t.removeAttribute("v-cloak")})}},Ds={text:Hr,html:Qr,for:as,if:hs,show:ls,model:vs,on:gs,bind:js,el:Es,ref:Ss,cloak:Fs},Ps={deep:!0,update:function(t){t?"string"==typeof t?this.setClass(t.trim().split(/\s+/)):this.setClass(Ee(t)):this.cleanup()},setClass:function(t){this.cleanup(t);for(var e=0,i=t.length;e<i;e++){var n=t[e];n&&Se(this.el,n,ct)}this.prevKeys=t},cleanup:function(t){var e=this.prevKeys;if(e)for(var i=e.length;i--;){var n=e[i];(!t||t.indexOf(n)<0)&&Se(this.el,n,ut)}}},Rs={priority:es,params:["keep-alive","transition-mode","inline-template"],bind:function(){this.el.__vue__||(this.keepAlive=this.params.keepAlive,this.keepAlive&&(this.cache={}),this.params.inlineTemplate&&(this.inlineTemplate=ft(this.el,!0)),this.pendingComponentCb=this.Component=null,this.pendingRemovals=0,this.pendingRemovalCb=null,this.anchor=mt("v-component"),st(this.el,this.anchor),this.el.removeAttribute("is"),this.el.removeAttribute(":is"),this.descriptor.ref&&this.el.removeAttribute("v-ref:"+u(this.descriptor.ref)),this.literal&&this.setComponent(this.expression))},update:function(t){this.literal||this.setComponent(t)},setComponent:function(t,e){if(this.invalidatePending(),t){var i=this;this.resolveComponent(t,function(){i.mountComponent(e)})}else this.unbuild(!0),this.remove(this.childVM,e),this.childVM=null},resolveComponent:function(t,e){var i=this;this.pendingComponentCb=w(function(n){i.ComponentName=n.options.name||("string"==typeof t?t:null),i.Component=n,e()}),this.vm._resolveComponent(t,this.pendingComponentCb)},mountComponent:function(t){this.unbuild(!0);var e=this,i=this.Component.options.activate,n=this.getCached(),r=this.build();i&&!n?(this.waitingFor=r,Fe(i,r,function(){e.waitingFor===r&&(e.waitingFor=null,e.transition(r,t))})):(n&&r._updateRef(),this.transition(r,t))},invalidatePending:function(){this.pendingComponentCb&&(this.pendingComponentCb.cancel(),this.pendingComponentCb=null)},build:function(t){var e=this.getCached();if(e)return e;if(this.Component){var i={name:this.ComponentName,el:le(this.el),template:this.inlineTemplate,parent:this._host||this.vm,_linkerCachable:!this.inlineTemplate,_ref:this.descriptor.ref,_asComponent:!0,_isRouterView:this._isRouterView,_context:this.vm,_scope:this._scope,_frag:this._frag};t&&v(i,t);var n=new this.Component(i);return this.keepAlive&&(this.cache[this.Component.cid]=n),n}},getCached:function(){return this.keepAlive&&this.cache[this.Component.cid]},unbuild:function(t){this.waitingFor&&(this.keepAlive||this.waitingFor.$destroy(),this.waitingFor=null);var e=this.childVM;return!e||this.keepAlive?void(e&&(e._inactive=!0,e._updateRef(!0))):void e.$destroy(!1,t)},remove:function(t,e){var i=this.keepAlive;if(t){this.pendingRemovals++,this.pendingRemovalCb=e;var n=this;t.$remove(function(){n.pendingRemovals--,i||t._cleanup(),!n.pendingRemovals&&n.pendingRemovalCb&&(n.pendingRemovalCb(),n.pendingRemovalCb=null)})}else e&&e()},transition:function(t,e){var i=this,n=this.childVM;switch(n&&(n._inactive=!0),t._inactive=!1,this.childVM=t,i.params.transitionMode){case"in-out":t.$before(i.anchor,function(){i.remove(n,e)});break;case"out-in":i.remove(n,function(){t.$before(i.anchor,e)});break;default:i.remove(n),t.$before(i.anchor,e)}},unbind:function(){if(this.invalidatePending(),this.unbuild(),this.cache){for(var t in this.cache)this.cache[t].$destroy();this.cache=null}}},Ls=Mn._propBindingModes,Hs={},Is=/^[$_a-zA-Z]+[\w$]*$/,Ms=Mn._propBindingModes,Ws={bind:function(){var t=this.vm,e=t._context,i=this.descriptor.prop,n=i.path,r=i.parentPath,s=i.mode===Ms.TWO_WAY,o=this.parentWatcher=new re(e,r,function(e){He(t,i,e)},{twoWay:s,filters:i.filters,scope:this._scope});if(Le(t,i,o.value),s){var a=this;t.$once("pre-hook:created",function(){a.childWatcher=new re(t,n,function(t){o.set(t)},{sync:!0})})}},unbind:function(){this.parentWatcher.teardown(),this.childWatcher&&this.childWatcher.teardown()}},Vs=[],Bs=!1,zs="transition",Us="animation",Js=nn+"Duration",qs=sn+"Duration",Qs=Gi&&window.requestAnimationFrame,Gs=Qs?function(t){Qs(function(){Qs(t)})}:function(t){setTimeout(t,50)},Zs=Ue.prototype;Zs.enter=function(t,e){this.cancelPending(),this.callHook("beforeEnter"),this.cb=e,ct(this.el,this.enterClass),t(),this.entered=!1,this.callHookWithCb("enter"),this.entered||(this.cancel=this.hooks&&this.hooks.enterCancelled,Be(this.enterNextTick))},Zs.enterNextTick=function(){var t=this;this.justEntered=!0,Gs(function(){t.justEntered=!1});var e=this.enterDone,i=this.getCssTransitionType(this.enterClass);this.pendingJsCb?i===zs&&ut(this.el,this.enterClass):i===zs?(ut(this.el,this.enterClass),this.setupCssCb(rn,e)):i===Us?this.setupCssCb(on,e):e()},Zs.enterDone=function(){this.entered=!0,this.cancel=this.pendingJsCb=null,ut(this.el,this.enterClass),this.callHook("afterEnter"),this.cb&&this.cb()},Zs.leave=function(t,e){this.cancelPending(),this.callHook("beforeLeave"),this.op=t,this.cb=e,ct(this.el,this.leaveClass),this.left=!1,this.callHookWithCb("leave"),this.left||(this.cancel=this.hooks&&this.hooks.leaveCancelled,this.op&&!this.pendingJsCb&&(this.justEntered?this.leaveDone():Be(this.leaveNextTick)))},Zs.leaveNextTick=function(){var t=this.getCssTransitionType(this.leaveClass);if(t){var e=t===zs?rn:on;this.setupCssCb(e,this.leaveDone)}else this.leaveDone()},Zs.leaveDone=function(){this.left=!0,this.cancel=this.pendingJsCb=null,this.op(),ut(this.el,this.leaveClass),this.callHook("afterLeave"),this.cb&&this.cb(),this.op=null},Zs.cancelPending=function(){this.op=this.cb=null;var t=!1;this.pendingCssCb&&(t=!0,at(this.el,this.pendingCssEvent,this.pendingCssCb),this.pendingCssEvent=this.pendingCssCb=null),this.pendingJsCb&&(t=!0,this.pendingJsCb.cancel(),this.pendingJsCb=null),t&&(ut(this.el,this.enterClass),ut(this.el,this.leaveClass)),this.cancel&&(this.cancel.call(this.vm,this.el),this.cancel=null)},Zs.callHook=function(t){this.hooks&&this.hooks[t]&&this.hooks[t].call(this.vm,this.el)},Zs.callHookWithCb=function(t){var e=this.hooks&&this.hooks[t];e&&(e.length>1&&(this.pendingJsCb=w(this[t+"Done"])),e.call(this.vm,this.el,this.pendingJsCb))},Zs.getCssTransitionType=function(t){if(!(!rn||document.hidden||this.hooks&&this.hooks.css===!1||Je(this.el))){var e=this.type||this.typeCache[t];if(e)return e;var i=this.el.style,n=window.getComputedStyle(this.el),r=i[Js]||n[Js];if(r&&"0s"!==r)e=zs;else{var s=i[qs]||n[qs];s&&"0s"!==s&&(e=Us)}return e&&(this.typeCache[t]=e),e}},Zs.setupCssCb=function(t,e){this.pendingCssEvent=t;var i=this,n=this.el,r=this.pendingCssCb=function(s){s.target===n&&(at(n,t,r),i.pendingCssEvent=i.pendingCssCb=null,!i.pendingJsCb&&e&&e())};ot(n,t,r)};var Xs={priority:Kr,update:function(t,e){var i=this.el,n=jt(this.vm.$options,"transitions",t);t=t||"v",e=e||"v",i.__v_trans=new Ue(i,t,n,this.vm),ut(i,e+"-transition"),ct(i,t+"-transition")}},Ys={style:$s,class:Ps,component:Rs,prop:Ws,transition:Xs},Ks=/^v-bind:|^:/,to=/^v-on:|^@/,eo=/^v-([^:]+)(?:$|:(.*)$)/,io=/\.[^\.]+/g,no=/^(v-bind:|:)?transition$/,ro=1e3,so=2e3;ui.terminal=!0;var oo=/[^\w\-:\.]/,ao=Object.freeze({compile:qe,compileAndLinkProps:Ye,compileRoot:Ke,transclude:_i,resolveSlots:Ci}),ho=/^v-on:|^@/;Oi.prototype._bind=function(){var t=this.name,e=this.descriptor;if(("cloak"!==t||this.vm._isCompiled)&&this.el&&this.el.removeAttribute){var i=e.attr||"v-"+t;this.el.removeAttribute(i)}var n=e.def;if("function"==typeof n?this.update=n:v(this,n),this._setupParams(),this.bind&&this.bind(),this._bound=!0,this.literal)this.update&&this.update(e.raw);else if((this.expression||this.modifiers)&&(this.update||this.twoWay)&&!this._checkStatement()){var r=this;this.update?this._update=function(t,e){r._locked||r.update(t,e)}:this._update=Ai;var s=this._preProcess?p(this._preProcess,this):null,o=this._postProcess?p(this._postProcess,this):null,a=this._watcher=new re(this.vm,this.expression,this._update,{filters:this.filters,twoWay:this.twoWay,deep:this.deep,preProcess:s,postProcess:o,scope:this._scope});this.afterBind?this.afterBind():this.update&&this.update(a.value)}},Oi.prototype._setupParams=function(){if(this.params){var t=this.params;this.params=Object.create(null);for(var e,i,n,r=t.length;r--;)e=u(t[r]),n=l(e),i=K(this.el,e),null!=i?this._setupParamWatcher(n,i):(i=Y(this.el,e),null!=i&&(this.params[n]=""===i||i))}},Oi.prototype._setupParamWatcher=function(t,e){var i=this,n=!1,r=(this._scope||this.vm).$watch(e,function(e,r){if(i.params[t]=e,n){var s=i.paramWatchers&&i.paramWatchers[t];s&&s.call(i,e,r)}else n=!0},{immediate:!0,user:!1});(this._paramUnwatchFns||(this._paramUnwatchFns=[])).push(r)},Oi.prototype._checkStatement=function(){var t=this.expression;if(t&&this.acceptStatement&&!Kt(t)){var e=Yt(t).get,i=this._scope||this.vm,n=function(t){i.$event=t,e.call(i,i),i.$event=null};return this.filters&&(n=i._applyFilters(n,null,this.filters)),this.update(n),!0}},Oi.prototype.set=function(t){this.twoWay&&this._withLock(function(){this._watcher.set(t)})},Oi.prototype._withLock=function(t){var e=this;e._locked=!0,t.call(e),ln(function(){e._locked=!1})},Oi.prototype.on=function(t,e,i){ot(this.el,t,e,i),(this._listeners||(this._listeners=[])).push([t,e])},Oi.prototype._teardown=function(){if(this._bound){this._bound=!1,this.unbind&&this.unbind(),this._watcher&&this._watcher.teardown();var t,e=this._listeners;if(e)for(t=e.length;t--;)at(this.el,e[t][0],e[t][1]);var i=this._paramUnwatchFns;if(i)for(t=i.length;t--;)i[t]();this.vm=this.el=this._watcher=this._listeners=null}};var lo=/[^|]\|[^|]/;Ht(Di),ki(Di),xi(Di),Ti(Di),Ni(Di),ji(Di),Ei(Di),Si(Di),Fi(Di);var co={priority:ss,params:["name"],bind:function(){var t=this.params.name||"default",e=this.vm._slotContents&&this.vm._slotContents[t];e&&e.hasChildNodes()?this.compile(e.cloneNode(!0),this.vm._context,this.vm):this.fallback()},compile:function(t,e,i){if(t&&e){if(this.el.hasChildNodes()&&1===t.childNodes.length&&1===t.childNodes[0].nodeType&&t.childNodes[0].hasAttribute("v-if")){var n=document.createElement("template");n.setAttribute("v-else",""),n.innerHTML=this.el.innerHTML,n._context=this.vm,t.appendChild(n)}var r=i?i._scope:this._scope;this.unlink=e.$compile(t,i,r,this._frag)}t?st(this.el,t):nt(this.el)},fallback:function(){this.compile(ft(this.el,!0),this.vm)},unbind:function(){this.unlink&&this.unlink()}},uo={priority:is,params:["name"],paramWatchers:{name:function(t){hs.remove.call(this),t&&this.insert(t)}},bind:function(){this.anchor=mt("v-partial"),st(this.el,this.anchor),this.insert(this.params.name)},insert:function(t){var e=jt(this.vm.$options,"partials",t,!0);e&&(this.factory=new _e(this.vm,e),hs.insert.call(this))},unbind:function(){this.frag&&this.frag.destroy()}},fo={slot:co,partial:uo},po=as._postProcess,vo=/(\d{3})(?=\d)/g,mo={orderBy:Li,filterBy:Ri,limitBy:Pi,json:{read:function(t,e){return"string"==typeof t?t:JSON.stringify(t,null,arguments.length>1?e:2)},write:function(t){try{return JSON.parse(t)}catch(e){return t}}},capitalize:function(t){return t||0===t?(t=t.toString(),t.charAt(0).toUpperCase()+t.slice(1)):""},uppercase:function(t){return t||0===t?t.toString().toUpperCase():""},lowercase:function(t){return t||0===t?t.toString().toLowerCase():""},currency:function(t,e,i){if(t=parseFloat(t),!isFinite(t)||!t&&0!==t)return"";e=null!=e?e:"$",i=null!=i?i:2;var n=Math.abs(t).toFixed(i),r=i?n.slice(0,-1-i):n,s=r.length%3,o=s>0?r.slice(0,s)+(r.length>3?",":""):"",a=i?n.slice(-1-i):"",h=t<0?"-":"";return h+e+o+r.slice(s).replace(vo,"$1,")+a},pluralize:function(t){var e=d(arguments,1),i=e.length;if(i>1){var n=t%10-1;return n in e?e[n]:e[i-1]}return e[0]+(1===t?"":"s")},debounce:function(t,e){if(t)return e||(e=300),y(t,e)}};return Ii(Di),Di.version="1.0.28",setTimeout(function(){Mn.devtools&&Zi&&Zi.emit("init",Di)},0),Di});
//# sourceMappingURL=vue.min.js.map
// Vue Customizations specific to Social Fixer
Vue.directive('tooltip', function (o) {
    this.el.setAttribute('data-hover','tooltip');
    // If a config object is passed, o will be parsed and populated
    if (o) {
        if (o.content) {
            this.el.setAttribute('title', o.content);
            this.el.setAttribute('data-tooltip-content', o.content);
        }
        o.uri && this.el.setAttribute('data-tooltip-uri',o.uri);
        this.el.setAttribute('data-tooltip-delay', (typeof o.delay!="undefined") ? o.delay : 1 * X.seconds);
        o.position && this.el.setAttribute('data-tooltip-position', o.position);
        o.align && this.el.setAttribute('data-tooltip-alignh', o.align);
        if (o.icon) {
            this.el.className="sfx-help-icon";
            this.el.setAttribute('data-tooltip-delay',1);
        }
    }
    else {
        this.el.setAttribute('data-tooltip-content', this.expression);
        this.el.setAttribute('title', this.expression);
        if (this.el.getAttribute('data-tooltip-delay')==null) {
            this.el.setAttribute('data-tooltip-delay', "1000");
        }
    }
});
Vue.filter('highlight', function(words, query){
    if (!query) {
        return words.toString();
    }
    var iQuery = new RegExp(query, "ig");
    return words.toString().replace(iQuery, function(matchedTxt){
        return ('<span class=\'sfx_highlight\'>' + matchedTxt + '</span>');
    });
});
Vue.filter('date', function(val){
    return (new Date(val)).toString().replace(/\s*GMT.*/,'');
});
Vue.filter('ago', function(val){
	return X.ago(val);
});

// Vue's 'json' filter, but return {} instead of '' on parse failure.
// Lets `v-model="my_obj | json+"` not fail when input buffer is empty.
Vue.filter('json+', {
    read: function (t, e) {
        return 'string' == typeof t ? t : JSON.stringify(t, null, arguments.length > 1 ? e : 2);
    },
    write: function (t) {
        try {
            return JSON.parse(t);
        } catch (e) {
            return {};
        }
    }
});

// Custom Components

// Option Checkbox
Vue.component('sfx-checkbox', {
    template:`<span><input id="sfx-cb-{{key}}" type="checkbox" v-on:click="click"/><label for="sfx-cb-{{key}}"></label></span>`,
    props: ['key'],
    activate: function(done) {
        this.$cb = X(this.$el.firstChild);
        this.$cb.prop('checked', FX.option(this.key));
        done();
    },
    methods: {
        click:function() {
            this.$cb.addClass('sfx_saving');
            FX.option(this.key, this.$cb.prop('checked'), true, function() {
                this.$cb.removeClass('sfx_saving');
            });
        }
    }

});
// For Vue Templates
// XXX 2022-09-13 noting a bug where sometimes Vue doesn't call the ready fn
// =============================
const template = function(appendTo,template,data,methods,computed,events) {
    var frag = document.createDocumentFragment();
    var ready = function(){};
    var v = new Vue(X.extend({
        "el":frag
        ,"template":template
        ,"data":data
        ,"methods":methods
        ,"computed":computed
        ,"replace":false
        ,"ready":function() { ready(v); }
    },events));
    if (appendTo) {
        v.$appendTo(appendTo); // Content has already been sanitized
    }
    var o = {
        "$view":v,
        "fragment":frag,
        "ready": function(func) {
            if (v._isReady) { func(); }
            else { ready=func; }
            return o;
        }
    };
    return o;
};

/*
 * This is a small library specific to Facebook functionality / extensions
 */
var FX = (function() {
    var css_queue = [];
    var on_page_load_queue = [];
    var on_page_unload_queue = [];
    var on_content_loaded_queue = [];
    var on_options_load_queue = [];
    var html_class_names = [];

    var fire_queue = function (arr, reset, arg) {
        if (!arr || !arr.length) {
            return;
        }
        arr.forEach(function (func) {
            try {
                func(arg);
            } catch(e) {
                console.log(e);
                console.log(e.toString());
                console.log(e.stack);
            }
        });
        if (reset) {
            arr.length = 0;
        }
    };

    // Monitor for hash change to detect when navigation has happened
    // TODO: Even for popups like photo viewer?!
    var page_transitioning = false;
    var page_transition = function() {
        if (page_transitioning) { return; } // Already initiated
        page_transitioning = true;
        // Fire the unload queue
        fire_queue(on_page_unload_queue);
        page_transitioning = false;
        fire_queue(on_page_load_queue);
    };
    // Monkey patch the pushState/replaceState calls in the main window to capture the event.
    // This will tell us if navigation happened that wasn't a full page reload
    // Detect changes through window.addEventListener(pushState|replaceState)
    var watch_history = function() {
        var _wr = function (type) {
            var orig = history[type];
            return function (state,title,url) {
                var url_change = (url && url!=location.href && !/theater/.test(url));
                var rv = orig.apply(this, arguments);
                if (url_change) {
                    var e = new Event(type);
                    e.arguments = arguments;
                    window.dispatchEvent(e);
                }
                return rv;
            };
        };
        window.history.pushState = _wr('pushState');
        window.history.replaceState = _wr('replaceState');
    };
    X.inject(watch_history);
    // Now listen for the state change events
    window.addEventListener("pushState",page_transition,false);
    window.addEventListener("replaceState",page_transition,false);

    // Facebook uses the HTML5 window.history.pushState() method to change url's in newer browsers.
    // Older browsers will use the hashchange approach
    window.addEventListener('hashchange',page_transition,false);
    window.addEventListener('popstate',page_transition,false);

    // Public API
    var fx = {};
    fx.css = function(css_text) {
        css_queue.push(css_text);
    };
    fx.css_dump = function() {
        if (css_queue.length==0) { return; }
        var css = css_queue.join('');
        X.css(css,'sfx_css');
    };

    // OPTIONS
    // -------
    // options : A hash of ALL available options, as defined by modules, along with default values
    fx.options = {};
    // is_options_loaded : Once options is loaded, this flag flips
    fx.is_options_loaded = false;
    fx.add_option = function(key,o) {
        o = o || {};
        o.key = key;
        o.type = o.type || 'checkbox';
        if (typeof o['default']=="undefined" && o.type=="checkbox") {
            o['default'] = false;
        }
        this.options[key] = o;
        if (typeof o.live == 'function') {
            fx.on_option_live(key, o.live);
        }
    };
    fx.option_default = function(key) {
        // If it's defined as an option, return the default value
        var opt = fx.options[key];
        if (typeof opt != 'undefined' && typeof opt['default'] != 'undefined') {
            return opt['default'];
        }
        // Default return null
        return null;
    };
    fx.option = function(key,value,save,callback) {
        // The defined option
        if (typeof value!="undefined") {
            // SET the value
            X.storage.set('options',key,value,function() {
                fx.fire_option_update(key,value);
                if (typeof callback=="function") {
                    callback();
                }
            },save);
            return value;
        }
        // GET the value
        // If it's defined in the storage layer, get that
        if (typeof X.storage.data.options!="undefined" && typeof X.storage.data.options[key]!="undefined") {
            return X.storage.data.options[key];
        }
        // Else if it's defined as an option, return the default value
        return fx.option_default(key);
    };
    // Attach event listeners to controls in the DOM to change Options
    fx.attach_options = function($dom) {
        $dom=X($dom);
        $dom.probe('*[sfx-option]').each(function(i,input) {
            var $input = X(input);
            if ($input.attr('sfx-option-attached')) { return; }
            var type = input.type;
            var option_key = $input.attr('sfx-option');
            if (!option_key || !fx.options[option_key]) { return; }
            var val = fx.option(option_key);
            $input.attr('sfx-option-attached','true');
            if (type=="checkbox") {
                // Checked by default?
                if (val) {
                    input.checked = true;
                }
                $input.click(function() {
                    val = !val;
                    fx.option(option_key,val);
                });
            }
            else if (type=="number") {
                if (val) {
                    input.value = val;
                }
                $input.change(function() {
                    fx.option(option_key,input.value);
                });
            }
            else {
                alert("FX.attach_options - Unhandled input type "+type);
            }
        });
    };
    fx.save_options = function(callback) {
        X.storage.save('options',null,callback);
    };
    fx.options_loaded = function(options) {
        fire_queue(on_options_load_queue,false,options);
        fx.css_dump();
        fx.html_class_dump();
        fx.is_options_loaded=true;
    };
    fx.on_options_load = function(func) {
        // If options are already loaded, just fire the func
        if (fx.is_options_loaded) {
            func();
        }
        else {
            on_options_load_queue.push(func);
        }
    };
    fx.on_option = function(option_name, value, func) {
        if (typeof value=="function") {
            func = value;
            value = true;
        }
        fx.on_options_load(function() {
            if (fx.option(option_name)==value) {
                func(fx.option(option_name));
            }
        });
    };
    var option_update_listeners = {};
    fx.on_option_update = function(option_name, func) {
        if (typeof option_update_listeners[option_name]=="undefined") { option_update_listeners[option_name]=[]; }
        option_update_listeners[option_name].push(func);
    };
    fx.fire_option_update = function(option_name,val) {
        var listeners = option_update_listeners[option_name];
        if (typeof listeners=="undefined") { return; }
        listeners.forEach(function(f) {
            f(val, option_name);
        });
    };
    fx.on_option_live = function(option_name, func) {
        if (Array.isArray(option_name)) {
            return option_name.forEach(opt => fx.on_option_live(opt, func));
        }
        fx.on_option_update(option_name, func);
        fx.fire_option_update(option_name, fx.option(option_name));
    };
    // Pass-through to non-option storage
    fx.storage = function(key) {
        return X.storage.data[key];
    };

    fx.add_html_class = function(name) {
        html_class_names.push(name);
        if (X.is_document_ready()) {
            fx.html_class_dump();
        }
    };
    fx.html_class_dump = function() {
        // Add HTML classes to the HTML tag
        if (html_class_names.length>0) {
            var h=document.getElementsByTagName('HTML')[0];
            h.className = (h.className?h.className:'') + ' ' + html_class_names.join(' ');
            html_class_names.length = 0;
        }
    };
    fx.on_page_load = function(func) {
        on_page_load_queue.push(func);
    };
    fx.on_page_unload = function(func) {
        on_page_unload_queue.push(func);
    };
    fx.on_content_loaded = function(func,isPriority) {
        if (fx.dom_content_loaded) {
            func();
        }
        else {
            if (isPriority) {
                on_content_loaded_queue.unshift(func);
            }
            else {
                on_content_loaded_queue.push(func);
            }
        }
    };
    fx.dom_content_loaded = false;
    fx.fire_content_loaded = function() {
        // Queue or Fire the DOMContentLoaded functions
        var content_loaded = function() {
            fx.dom_content_loaded = true;
            fx.html_class_dump();
            fire_queue(on_content_loaded_queue,true);
            fire_queue(on_page_load_queue);
            fx.html_class_dump();
        };
        if (X.is_document_ready()) {
            content_loaded();
        }
        else {
            window.addEventListener('DOMContentLoaded',function() {
                content_loaded();
            }, { capture: false, once: true });
        }
    };

    // Dynamic content insertion / removal
    fx.domNodeInsertedHandlers = [];
    fx.domNodeRemovedHandlers = [];
    fx.on_content_inserted = func => fx.domNodeInsertedHandlers.push(func);
    fx.on_content_removed = func => fx.domNodeRemovedHandlers.push(func);
    fx.on_content = function(func) {
        // Inserted content
        fx.on_content_inserted(func);
        // Static content on page load
        fx.on_content_loaded(function() {
            func(X(document.body));
        });
    };
    fx.on_selector = function(selector,func) {
        var f = function($o) {
            $o.probe(selector).forEach(function(item) {
                func(X(item));
            });
        };
        fx.on_content(f);
    };

    // Remove newlines & leading whitespace from a tagged template literal:
    //     var x = "?"; fx.oneLineLtrim(`foo${x} \n    bar`) ==> "foo? bar"
    // Trailing spaces are intentionally retained.
    //
    // Purpose: Facebook's HTML is all crammed together; do the same to ours,
    // while still allowing nice indented, readable HTML in our source.
    fx.oneLineLtrim = function(str) {
        return str.replace(/[\n\r]+\s*/g, '');
    };

    fx.sfx_support_groups = [
        'SocialFixerUserSupport',  // Previous Support group, trashed by FB in early 2020
        '412712822130938',         // -- in its numeric form
        'SocialFixerUsersSupport', // Current Support group since early 2020
        '413697228741798',         // -- in its numeric form
        '327097871787555',         // Social Fixer BETA Testers
    ];
    // Navigation Context
    fx.context = {"type":null, "id":null};
    fx.on_page_load(function() {
        if (fx.option('disabled')) {
            return;
        }

        var set_html_context = function () {
            X(document.documentElement).attr({
                sfx_url: window.location.pathname,
                sfx_context_type: fx.context.type,
                sfx_context_id: fx.context.id,
                sfx_context_permalink: fx.context.permalink,
            });
            X.support_note('sfx_context', `{ url: ${window.location.pathname}, type: ${fx.context.type}, id: ${fx.context.id}, permalink: ${fx.context.permalink} }`);
            if (fx.context.type == 'groups' && fx.sfx_support_groups.includes(fx.context.id)) {
                X('html').addClass('sfx_support_group');
            }
        };

        // https://www.facebook.com/foo/bar/baz?abc=def => ['foo','bar','baz']
        var context = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');

        if (!context || !context[0] || context[0] == 'home.php') {
            // facebook.com
            // facebook.com/home.php
            fx.context.type = "newsfeed";
            fx.context.id = null;
        } else if (context[0] == 'marketplace') {
            // facebook.com/marketplace => marketplace / ''
            // facebook.com/marketplace/you, etc. => marketplace / you
            // facebook.com/marketplace/category/electronics => marketplace / electronics
            fx.context.type = context[0];
            fx.context.id = (context[1] == 'category') ? context[2] : context[1];
        } else if (context[0] == 'messages') {
            // facebook.com/messages/t/$id
            // facebook.com/messages/[anything else] ==> id = null
            fx.context.type = "messages";
            fx.context.id = (context[1] == 't') ? context[2] : null;
        } else if (/messenger\.com$/.test(window.location.hostname)) {
            // messenger.com/t/$id
            // messenger.com/[anything else] ==> id = null
            fx.context.type = "messages";
            fx.context.id = (context[0] == 't') ? context[1] : null;
        } else if (context.length == 1 || context[1] == 'posts') {
            // facebook.com/$id
            // facebook.com/$id/posts  [ obsolete? ]
            fx.context.type = "profile";
            fx.context.id = context[0];
        } else if (context[0] == 'pg' && context[2] == 'posts') {
            // facebook.com/pg/$id/posts
            fx.context.type = "profile";
            fx.context.id = context[1];
        } else if (context[0] == 'groups') {
            // facebook.com/groups/$id/...
            fx.context.type = 'groups';
            fx.context.id = context[1];
            if (/^\d+$/.test(fx.context.id)) {
                // Collect the group's URL *name* when visited by *number*, e.g.
                // facebook.com/groups/412712822130938 => 'SocialFixerUserSupport'.
                // This ID is used to prevent filtering on SFx Support Groups, to
                // highlight the pinned post, and as a datum in the Support info.
                var group_href = X('a._5pcq[href^="/groups/"]').attr('href');
                if (group_href) {
                    // If href contains numeric ID, the Group's name *is* numeric
                    fx.context.id = group_href.split('/')[2];
                } else {
                    // Numeric ID and no posts have been loaded yet; try later.
                    // Might filter some posts on Support Groups; user should
                    // use Group's real name!  And pinned post highlighting may
                    // be delayed.  And 2s might not be long enough?
                    setTimeout(function () {
                        var group_href = X('a._5pcq[href^="/groups/"]').attr('href');
                        if (group_href) {
                            fx.context.id = group_href.split('/')[2];
                            set_html_context();
                        }
                    }, 2 * X.seconds);
                }
            }
        } else {
            // context.length >= 2
            // facebook.com/$type/$id
            fx.context.type = context[0];
            fx.context.id = context[1];
        }

        var query = window.location.search.replace(/^\?/, '');
        fx.context.permalink = (
            context[1] == 'posts' && /^\d/.test(context[2]) ||  // facebook.com/$user/posts/$id
            context[1] == 'posts' && /^pfbid0/.test(context[2]) ||  // facebook.com/$user/posts/pfbid$gibberish
            context[0] == 'permalink.php' ||        // facebook.com/permalink.php?story_fbid=$id
            /notif_id=/.test(query) ||              // facebook.com/media/set/?set=$id&...&notif_id=$id, etc.
            context[0] == 'groups' && (
                /view=permalink/.test(query) ||     // facebook.com/groups/$group?view=permalink&id=$id
                /multi_permalinks=/.test(query) ||  // facebook.com/groups/$group/?multi_permalinks=$id
                context[2] == 'posts' ||            // facebook.com/groups/$group/posts/$id
                context[2] == 'permalink'           // facebook.com/groups/$group/permalink/$id
            )
        );

        set_html_context();
        X.publish('context/ready');
        X.subscribe('context/changed', set_html_context);
    });

    // "Reflow" a news feed page when posts have been hidden/shown, so Facebook's code kicks in and resizes containers
    // 2018-10-18 Bela: this no longer appears to be necessary or helpful.
    // It clashes mightily with FB's de-duplication 'feature' (to hide their server-side bugs);
    // it also, somehow, makes scrolling through posts much slower, feels like it leaves the
    // memory manager in an unhappy state.
    // So, function remains for its callers, but does only the 'scroll_to_top' feature.

    fx.reflow = function(scroll_to_top) {
        if (scroll_to_top) {
            window.scrollTo(0, 3);
        }
    };

    fx.mutations_disabled = false;
    fx.disable_mutations = function() { fx.mutations_disabled=true; };
    fx.enable_mutations = function() { fx.mutations_disabled=false; };
    const ignoreTagNamesRegex = /^(?:SCRIPT|LINK|INPUT|BR|STYLE|META|IFRAME|AUDIO|EMBED)$/i;
    const ignoreClassNameRegex = /tooltipText/i;
    const ignoreParentClassNameRegex = /none_to_ignore_right_now/;
    const ignoreSfxIDsRegex = /sfx[-_]/;
    const ignoreSfxClassNameRegex = /sfx[-_]/;
    const ignoreMutation = node =>
        node.nodeType != 1 ||
        ignoreTagNamesRegex.test(node.tagName) ||
        ignoreClassNameRegex.test(node.className) ||
        (node.parentNode && ignoreParentClassNameRegex.test(node.parentNode.className));
    const ignoreInsertion = node =>
        ignoreMutation(node) ||
        ignoreSfxIDsRegex.test(node.id) ||
        ignoreSfxClassNameRegex.test(node.className);
    const ignoreRemoval = ignoreMutation;
    const domNodeInserted = node =>
        ignoreInsertion(node) ||
        fx.domNodeInsertedHandlers.some(handler => handler(X(node)));
    const domNodeRemoved = node =>
        ignoreRemoval(node) ||
        fx.domNodeRemovedHandlers.some(handler => handler(X(node)));
    const _observer = mutations =>
        fx.mutations_disabled ||
        mutations.forEach(mutation => {
            mutation.type === 'childList' && mutation.addedNodes.forEach(domNodeInserted);
            mutation.type === 'childList' && mutation.removedNodes.forEach(domNodeRemoved);
        });
    X(() => new MutationObserver(_observer).observe(document.body, { childList: true, subtree: true }));

    // Return the API
    // ==============
    return fx;
})();

const SFX = {
    version: '30.0.0',
    buildtype: 'userscript',
    releasetype: '',
    userscript_agent: undefined,
    user_agent: 'Browser: ' + navigator.userAgent,
    instance: 'sfx_' + ((1 + Math.random()) * (36**6)).toString(36).replace(/^1|\..*/g, ''),
};
SFX.badge_sel = '[id=sfx_badge].' + SFX.instance;
const GMinfo = typeof GM !== 'undefined' ? GM.info : typeof GM_info !== 'undefined' ? GM_info : null;
if (SFX.buildtype == 'userscript') {
   SFX.userscript_agent = (!GMinfo ? "unknown-userscript-manager v:unknown" :
      (GMinfo.scriptHandler || "Greasemonkey") + " v:" + (GMinfo.version || "unknown"));
   if (GMinfo && GMinfo.script && GMinfo.script.version) {
      SFX.version = GMinfo.script.version;
   }
}
if (SFX.releasetype) SFX.version = `${SFX.releasetype} ${SFX.version}`;
if (!SFX.extension_id && typeof browser !== 'undefined' && browser.runtime) SFX.extension_id = browser.runtime.id;
if (!SFX.extension_id && typeof chrome !== 'undefined' && chrome.runtime) SFX.extension_id = chrome.runtime.id;
[
    [ 'betterfacebook@mattkruse.com',     'Firefox',             'Firefox Browser Add-ons' ],
    [ 'bhaooomeolkdacolgpkfbfookhomkbei', 'Edge',                'Microsoft Edge Add-ons' ],
    [ 'gbhlbkifncomjccjcdjokniojhnojmcn', 'Chrome (beta build)', 'Google Chrome Web Store (beta)' ],
    [ 'ifmhoabcaeehkljcfclfiieohkohdgbb', 'Chrome',              'Google Chrome Web Store' ],
    [ 'inficfabgpfjiegjgnhmjdagmhlmakoo', 'Opera',               'Opera addons' ],
    [ 'safari',                           'Safari',              'Mac App Store' ],
    [ 'userscript',                       'Userscript',          SFX.userscript_agent ],
                                                                 // e.g. 'Tampermonkey v:4.13.6136'
    [ 'default',                          'Unknown',             `${SFX.extension_id} from an unknown source` ],
].find(ident => {
    if (SFX.extension_id == ident[0] || SFX.buildtype == ident[0] || ident[0] == 'default') {
        SFX.extension_build_target = ident[1];
        SFX.extension_store_name = ident[2];
        if (ident[1] == 'Userscript') {
            SFX.extension_id = (GMinfo && GMinfo.script) ? GMinfo.script.name : 'Unknown';
        }
        return true;
    }
});
SFX.buildstr = `${SFX.version} (${SFX.buildtype}, ${SFX.extension_store_name})`;

SFX.is_sfx_element = el => (
    (el = X(el)[0]) && (
        /^sfx_/.test(el.id) ||
        Array.from(el.classList).some(cl => /^sfx_/.test(cl))
    )
);

SFX.Ctrl = (/Macintosh|Mac OS X/.test(SFX.user_agent)) ? 'Command' : 'Ctrl';

// If running as a Web Extension, communicate with the background script
// to perform ajax fetches which are not blocked by CORS / CORB.
if (SFX.buildtype !== 'userscript' && typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
    SFX.ajax_cor = function(urlOrObject, callback) {
        const do_callback = function(response) {
            const headers = {};
            const xhr = response.xhr || {};
            if (response.type != 'load') {
                return callback(response.type, xhr.status, headers);
            }
            xhr.responseHeaders && xhr.responseHeaders.split(/\r?\n/).forEach(function (header) {
                const val = header.split(/\s*:\s*/, 2);
                headers[val[0].toLowerCase()] = val[1];
            });
            callback(xhr.responseText, xhr.status, headers);
        };
        const request = {
            method: urlOrObject.method || 'GET',
            timeout: urlOrObject.timeout || 5.0 * X.seconds,
            url: urlOrObject.url || urlOrObject,
        };
        if (!request.url) {
            alert('Invalid parameter passed to ajax_cor');
            return callback(null);
        }
        chrome.runtime.sendMessage({
            sfx: true,
            call: 'ajax_cor',
            request,
        }, do_callback);
    };
} else {
    SFX.ajax_cor = (urlOrObject, callback) => callback('no background script, use X.ajax()', urlOrObject);
}

// 'fuzzy reference': fref(obj, /bc.*de/) finds obj.abc_xyz_def
SFX.fref = function (obj, kex) {
    for (var key of Object.keys(obj || {})) if (kex.test(key)) return obj[key];
    return {};
};
// 'fuzzy reference arguments' converts 'abc,de.*f' to [/abc/, /de.*f/]
// This allows powerful shorthand for fuzzy path lookups.
SFX.frefargs = (...keyargs) =>
    keyargs.flat(Infinity).map(keyarg =>
        keyarg instanceof RegExp ? keyarg : keyarg.split(',').map(str => new RegExp(str))
    ).flat(Infinity);
// 'fuzzy reference': frefpath(obj, /bc.*de/, 'foo') or frefpath('bc.*de,foo') finds obj.abc_xyz_def.foobar
SFX.frefpath = (obj, ...kex_arr) => SFX.frefargs(kex_arr).reduce((obj, kex) => SFX.fref(obj, kex), obj);

// This isn't a complete 'deep equals', but suffices for our purposes.
SFX.data_equals = function(obj, pbj) {
    if (obj === pbj) return true;
    if (obj === null || pbj === null ||
        typeof obj !== 'object' || typeof pbj !== 'object' ||
        Object.keys(obj).length != Object.keys(pbj).length) return false;
    return Object.keys(obj).every(key => SFX.data_equals(obj[key], pbj[key]));
};

// do [].push, if the item is truthy & not already in the array; returns the array
SFX.pushy = (arr, item) => ((item && !arr.includes(item) && arr.push(item)),arr);

// Export symbols for use by other SFx modules
SFX.port = ((vars) => Object.assign(SFX, vars));

// Allow debug exposure of internals when enabled (no UI to enable)
// This is for debugging in the field.  It is never enabled without
// Support interaction.

SFX.dbg = {};

// Harmlessly record references without actually exposing
SFX.pose = ((vars) => Object.assign(SFX.dbg, vars));
SFX.pose({ X, FX, SFX, });

// Actually expose the references, if the hidden option is set
X.ready('xpose_dbg', function() {
  FX.on_option_live('xpose_dbg', function(enabled) {
    if (!enabled) {
        return;
    }
    let exposee = { X, FX, SFX, SFX_dbg: SFX.dbg, };
    let global = window.unsafeWindow ||  // Userscript runners
                 window.globalThis   ||  // Browsers
                 window;                 // Old browsers

    // This exposes them in any browser and SFx packaging (extension / userscript)
    // The user can then manipulate them directly or right-click > Store as global
    console.log('Social Fixer debug data', exposee);

    // This potentially exposes them a bit more directly in some situations, making
    // globals 'X', 'FX', 'SFX', 'SFX_dbg' immediately accessible
    //
    // As of Tampermonkey version 4.16.6158, this also requires the following
    // setting to be enabled:
    //
    //     script's Settings > GM/FF > Add GM functions to this or window > On (or Auto)
    Object.assign(global, exposee);
  });
});

X.subscribe('sfx/debug', (msg, data) => FX.option('xpose_dbg', typeof data.on === 'boolean' ? data.on : !FX.option('xpose_dbg')));


// Main Source
// ===========
X.ready('aargh_fb_gibberish', function () {
    // This layer handles FB's ever-changing array of gibberish CSS
    // class names.  Rolling out initially in late 2019, they now use
    // a gigantic set of 'atomic' CSS classes in their code. 'atomic'
    // in the sense that most (but not all) are classes specifying
    // the smallest possible possible particle of CSS meaning.  For
    // instance, where they might once have had a class meaning
    // 'border: 3px dashed red', they would now use separate classes
    // meaning 'border-left-width: 3px', 'border-left-style: dashed',
    // 'border-left-color: red', plus 3 more sets for border-right,
    // border-top, border-bottom.
    //
    // At the same time as they switched to these CSS 'atoms', they also
    // removed most other logical markup from their HTML, making it ever
    // more difficult to *find* things like 'this is the top node of a
    // post' or 'this is a box in which an ad might appear'.  We find
    // such things by evaluating which CSS is required to display them
    // in the desired manner, then looking for that CSS by atom-name.
    //
    // But then, they keep *changing* those atom-names.  There was an
    // initial set in 2019 (mostly seen by users for the first time in
    // 2020); another set in early/mid 2022; now a 3rd major set in late
    // 2022.  The pace of replacement is increasing, so now we will
    // determine them dynamically at runtime and use our own abstraction
    // layer in our CSS lookups.
    //
    // These abbreviations are used in SFx and socialfixerdata CSS,
    // which is then translated at runtime into CSS which correctly
    // operates the current FB page-at-hand.
    //
    // They are restricted to 10 chars by convention, and by code to
    // digits, lowercase letters, and underscores.  In CSS they are
    // prefixed with 'S2F_' (SFx to FB), so there is no chance at all of
    // namespace conflict; e.g. '.S2F_col_bt1.S2F_font_700'.
    //
    // Yes, it's all incredibly ugly.  Thanks, FB!
    //
    // The words and names 'gibberishes', 'gibberi', 'gibs', 'gib',
    // etc. refer to the gibberish hash names FB are using for these
    // classes.  In the late-2022 version of the scheme, these are
    // 6-to-8 character names composed of lowercase letters and
    // digits, always starting with an 'x'. e.g. '.x1rg5ohu' means
    // 'display:inline-block'.  In SFx CSS this will now be represented
    // as '.S2F_disp_inlb' and translated at runtime to whatever is
    // needed to match the CSS in use by the current page.

    SFX.gib = {
        alinc_flst: { css:'align-content:flex-start', },
        alini_cent: { css:'align-items:center', },
        alini_fxnd: { css:'align-items:flex-end', },
        alini_stre: { css:'align-items:stretch', },
        alisl_cent: { css:'align-self:center', },
        bb_1pxdiv:  { css:'border-bottom:1px solid var(--divider)', },
        bb_bt2:     { css:'border-bottom:1px solid var(--secondary-button-background)', },
        bbcol_div:  { css:'border-bottom-color:var(--divider)', },
        bb_dark:    { css:'border-bottom-color:var(--always-dark-overlay)', },
        bbl_rad0:   { css:'border-bottom-left-radius:0px', },
        bbl_rad10:  { css:'border-bottom-left-radius:10px', },
        bbl_rad50:  { css:'border-bottom-left-radius:50%', },
        bbl_radcrd: { css:'border-bottom-left-radius:var(--card-corner-radius)', },
        bg_accent:  { css:'background-color:var(--accent)', },
        bg_bt2:     { css:'background-color:var(--secondary-button-background)', },
        bg_card:    { css:'background-color:var(--card-background)', },
        bg_cbg:     { css:'background-color:var(--comment-background)', },
        bg_hilit:   { css:'background-color:var(--highlight-bg)', },
        bg_surf:    { css:'background-color:var(--surface-background)', },
        bg_trans:   { css:'background-color:transparent', },
        bot_0:      { css:'bottom:0px', },
        bt_divid:   { css:'border-top:1px solid var(--divider)', },
        btl_rad0:   { css:'border-top-left-radius:0px', },
        bxs_bbox:   { css:'box-sizing:border-box', },
        ch1_none:   { css:'display:none', pseudo:':first-child', },
        col_acc:    { css:'color:var(--accent)', },
        col_bt1:    { css:'color:var(--primary-button-text)', },
        col_btdis:  { css:'color:var(--disabled-button-text)', },
        col_tx1:    { css:'color:var(--primary-text)', },
        col_tx1med: { css:'color:var(--primary-text-on-media)', },
        col_tx2:    { css:'color:var(--secondary-text)', },
        curs_def:   { css:'cursor:default', },
        curs_not:   { css:'cursor:not-allowed', },
        disp_blok:  { css:'display:block', },
        disp_cont:  { css:'display:contents', },
        disp_flex:  { css:'display:flex', },
        disp_infl:  { css:'display:inline-flex', },
        disp_inlb:  { css:'display:inline-block', },
        disp_inl:   { css:'display:inline', },
        empty_none: { css:'display:none',   pseudo:':empty', },
        en_nozi:    { css:'z-index:unset',  prefix:'\\.GIB:not\\(\\[disabled]\\) +', },
        fcs_col_ph: { css:'color:var(--placeholder-text)', pseudo:':focus', },
        ffam_def:   { css:'font-family:var(--font-family-default)', },
        fhd_wide:   { css:'max-width:none', media:'max-width:1920px', },
        flbs_100:   { css:'flex-basis:100%', },
        flbs_inh:   { css:'flex-basis:inherit', },
        fldr_col:   { css:'flex-direction:column', },
        fldr_row:   { css:'flex-direction:row', },
        fldr_rrow:  { css:'flex-direction:row-reverse', },
        flex_0px:   { css:'flex-basis:0px', },
        flex_shr1:  { css:'flex-shrink:1', },
        flex_wrap:  { css:'flex-wrap:wrap', },
        flgr_1:     { css:'flex-grow:1', },
        flsh_0:     { css:'flex-shrink:0', },
        flwr_no:    { css:'flex-wrap:nowrap', },
        font_400:   { css:'font-weight:400', },
        font_600:   { css:'font-weight:600', },
        font_700:   { css:'font-weight:700', },
        font_bold:  { css:'font-weight:bold', },
        hei_100:    { css:'height:100%', },
        hei_100_hh: { css:'height:calc(100vh\\s*-\\s*var(--header-height))', },
        hei_1:      { css:'height:1px', },
        hei_inh:    { css:'height:inherit', },
        just_cent:  { css:'justify-content:center', },
        just_flst:  { css:'justify-content:flex-start', },
        just_spbt:  { css:'justify-content:space-between', },
        left_0:     { css:'left:0px', },
        list_none:  { css:'list-style:none', },
        mb_0:       { css:'margin-bottom:0px', },
        mb_6:       { css:'margin-bottom:6px', },
        mr_auto:    { css:'margin-right:auto', },
        mw_100:     { css:'max-width:100%', },
        oflx_hid:   { css:'overflow-x:hidden', },
        opac_0:     { css:'opacity:0', },
        opac_1:     { css:'opacity:1', },
        oscrx_cont: { css:'overscroll-behavior-x:contain', },
        oscry_cont: { css:'overscroll-behavior-y:contain', },
        outl_none:  { css:'outline:none', },
        ovfa_n:     { css:'overflow-anchor:none', },
        ow_bw:      { css:'overflow-wrap:break-word', },
        padb_12:    { css:'padding-bottom:12px', },
        padl_16:    { css:'padding-left:16px', },
        padt_16:    { css:'padding-top:16px', },
        pos_abs:    { css:'position:absolute', },
        pos_fix:    { css:'position:fixed', },
        pos_rel:    { css:'position:relative', },
        pos_stk:    { css:'position:sticky', },
        ryt_0:      { css:'right:0px', },
        snap_st:    { css:'scroll-snap-align:start', },
        top_0:      { css:'top:0px', },
        top_hdrh:   { css:'top:var(--header-height)', },
        touch_man:  { css:'touch-action:manipulation', },
        trans_n:    { css:'transform:none', pseudo:':active', },
        ttf_eei:    { css:'transition-timing-function:var(--fds-animation-enter-exit-in)', },
        txal_cent:  { css:'text-align:center', },
        txtr_lower: { css:'text-transform:lowercase', },
        va_bot:     { css:'vertical-align:bottom', },
        va_mid:     { css:'vertical-align:middle', },
        vis_vis:    { css:'visibility:visible', },
        wid_100:    { css:'width:100%', },
        wid_1:      { css:'width:1px', },
        wid_fit:    { css:'width:fit-content', },
        wid_panel:  { css:'width:var(--global-panel-width)', },
        wsp_pre:    { css:'white-space:pre-wrap', },
        zi_0:       { css:'z-index:0', },
        zi_1:       { css:'z-index:1', },
        zi_2:       { css:'z-index:2', },
    };

    const log = X.logger('fb_gibberish');

    SFX.gib_make_regexes = function() {
        log(`make_regexes start`);
        Object.values(SFX.gib).forEach(function(entry) {
            let pfx = entry.prefix ? entry.prefix.replace(/GIB/g,'[a-z0-9]{6,8}') : '';
            let psu = entry.pseudo || '';
            let css = entry.css.replace(/:/, ': *').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
            let capture = entry.media ? '\\.([a-z0-9]{6,8})\\.\\1' : '\\.([a-z0-9]{6,8})';
            entry.re = new RegExp(`^${pfx}${capture}${psu} *{ *${css}[ ;]*}`);
            entry.media_re = entry.media ? new RegExp(entry.media.replace(/:/g, ': *')) : /^$/;
        });
        log(`make_regexes end`);
    };

    SFX.gib_find_rule = function(entry, cssMedia, cssText) {
        if (entry.media_re.test(cssMedia) && entry.re.test(cssText)) {
            let newgib = RegExp.$1;
            if (entry.gib && entry.gib != newgib) {
                // 2 gibberi resolve to the same CSS atom: keep the more popular one
                let new_count = X('.' + newgib).length + 1;
                let old_count = entry.count || X('.' + entry.gib).length;
                entry.gib = (new_count > old_count) ? newgib : entry.gib;
                entry.count = Math.max(new_count, old_count);
            } else {
                entry.gib = newgib;
            }
        }
    };

    const basename = (str) => str.replace(/^.*\/|\?.*$/g, '');

    SFX.gib_find_all = function(entries = SFX.gib) {
        log(`find_all start (n = ${Object.keys(entries).length})`);

        // Traverse all style rules in the DOM

        // The per-sheet logging in this loop displays only (1) failed sheets
        // (which are expected but not required to be ones with URLs) and (2)
        // duplicated sheets we've made from failed sheets (which will always
        // have a URL).  If all is well, the log should show a failed attempt
        // with a sheet name, followed by a later success with the same name.

        for (let idx = 0; idx < document.styleSheets.length; ++idx) {
            const sheet = document.styleSheets[idx];
            try {
                for (const rule of sheet.cssRules) {
                    let cssMedia = (rule instanceof CSSMediaRule) ? Array.from(rule.media).join(',') : '';
                    let cssText =  (rule instanceof CSSMediaRule) ? Array.from(rule.cssRules).map(subrule => subrule.cssText).join(' ') : rule.cssText;
                    // Does this rule define one of the gibberi we're looking for?
                    Object.values(entries).forEach(entry => SFX.gib_find_rule(entry, cssMedia, cssText));
                }
                if (sheet.disabled && sheet.ownerNode) {
                    const name = sheet.ownerNode.getAttribute('sfx_name');
                    if (name) {
                        log(`find_all stylesheet #${idx} '${name}' ok`);
                    }
                }
            } catch(e) {
                const name = sheet.href ? ` '${basename(sheet.href)}'` : '';
                log(`find_all stylesheet #${idx}${name} failed: ${e.toString()}`);
            }
        }
        log(`find_all end`);
    };
    SFX.gib_find_one = entry => SFX.gib_find_all([entry]);

    // The following ugliness is because we can't read some of the loaded
    // stylesheets due to CORS.  But they document their URLs and we *do*
    // have the power to download them, so let's do that.  urghghh.
    SFX.gib_stylesheet_count = 0;
    SFX.gib_stylesheet_filenames = [];
    SFX.gib_retrieve_stylesheet = url => {
        const filename = basename(url);
        if (!SFX.gib_stylesheet_filenames.includes(filename)) {
            SFX.gib_stylesheet_filenames.push(filename);
            log(`retrieve_stylesheet '${filename}'`);
            // Grab that style's source
            return new Promise(resolve => {
                X.ajax(url, css => {
                    let sheet_id = `sfx_gib_stylesheet_${SFX.gib_stylesheet_count++}`;
                    // Cram it into a stylesheet
                    X.css(css, sheet_id);
                    X.when(`#${sheet_id}`, function($style_node) {
                        // X.css() is async.  When done, tag the style node so
                        // we can recognize it; then find the corresponding
                        // styleSheet and disable it; no reason for the browser
                        // to be working extra hard to apply the same rules twice.
                        // We just need the browser's power of parsing CSS...
                        $style_node.attr('sfx_name', filename);
                        for (const sheet of document.styleSheets) {
                            if (sheet.ownerNode && sheet.ownerNode.id == sheet_id) {
                                sheet.disabled = true;
                                log(`stylesheet '${filename}' successfully retrieved`);
                            }
                        }
                        resolve(true);
                    });
                });
            });
        }
        return Promise.resolve(true);
    };
    SFX.gib_retrieve_stylesheets = function() {
        const promises = [];
        for (const sheet of document.styleSheets) {
            try {
                sheet.cssRules[0];
            } catch(e) {
                // That stylesheet's rules aren't accessible (CORS?)
                // But maybe we can load it by URL...
                if (sheet.href) {
                    promises.push(SFX.gib_retrieve_stylesheet(sheet.href));
                }
            }
        }
        return Promise.all(promises);
    };

    // Repair any early styles which used gibs
    SFX.gib_styles_fixed = false;
    SFX.gib_fix_styles = function() {
        if (SFX.gib_styles_fixed) {
            return;
        }
        SFX.gib_styles_fixed = true;
        X('head style[id^=sfx_]').forEach(style => {
            ocss = style.textContent;
            ncss = SFX.gib_convert(ocss);
            if (ncss != ocss) style.textContent = ncss;
        });
    };

    let retry_msg = '';
    let retry_time = 0.5;

    SFX.gib_verify = function() {
        let total = Object.keys(SFX.gib).length;
        let found = Object.values(SFX.gib).reduce((v,entry) => v + !!entry.gib, 0);
        let inuse = Object.values(SFX.gib).reduce((v,entry) => v + !!document.querySelector(`.${entry.gib}`), 0);
        X.support_note('fb_gibberish', `gibs to find: ${total}; found: ${found}; inuse: ${inuse}${retry_msg}`);
        log(`verify ${total}:${found}:${inuse}${retry_msg}`);
        if (retry_time < 10 && (found < total / 3 || inuse < total / 10)) {
            setTimeout(() =>
                SFX.gib_retrieve_stylesheets().then(() => {
                    if (found < total) {
                        SFX.gib_find_all();
                    }
                    SFX.gib_verify();
                }), retry_time * X.seconds);
            retry_time *= 2;
        } else {
            SFX.gib_fix_styles();
        }
        retry_msg = ` (retry, previously ${total}:${found}:${inuse})`;
    };

    SFX.gib_make_regexes();
    SFX.gib_retrieve_stylesheets().then(() => {
        SFX.gib_find_all();
        SFX.gib_verify();
    });

    SFX.gib_missing = [];
    SFX.gib_replace = function(token, name, _position, string) {
        if (name in SFX.gib && SFX.gib[name].gib) { // Translation already found
            return SFX.gib[name].gib;
        }
        if (name in SFX.gib) { // Translation not found during setup, maybe now??
            log(`replace retrying '${name}'`);
            SFX.gib_retrieve_stylesheets();
            SFX.gib_find_one(SFX.gib[name]);
            if (SFX.gib[name].gib) {
                SFX.gib_verify();
                log(`replace succeeded '${name}'`);
                return SFX.gib[name].gib;
            }
            log(`replace failed '${name}'`);
            SFX.gib[name].gib = token;
        }
        if (!SFX.gib_missing[name]) SFX.gib_missing[name] = {};
        SFX.gib_missing[name][string] = (SFX.gib_missing[name][string] || 0) + 1;
        return token;
    };
    SFX.gib_convert = str => str.replace(/S2F_([a-z0-9_]*)/g, SFX.gib_replace);
});

FX.add_option('run_on_apps', {"title": 'Run On Apps and Games Pages', "description": 'Run Social Fixer on apps and games pages from apps.facebook.com.', "default": true});
X.beforeReady(function(options) {
    if (/apps.facebook.com/.test(location.href)) {
        if (!options) {
            // Don't run modules yet until prefs are loaded
            return false;
        }
        else {
            //Otherwise check prefs to see if modules should run
            return FX.option('run_on_apps');
        }
    }
});

// =============================================
// "Bubble" Notes are panels to display... notes
// =============================================
var bubble_note_anon_count = 0;

const bubble_note = function(content,options) {
    options = options || {};
    options.position = options.position || "top_right";
    if (typeof options.close!="boolean") { options.close=false; }
    if (typeof options.draggable!="boolean") { options.draggable=true; }
    // If ID is passed, remove old one if it exists
    if (options.id) {
        X(`[id=${options.id}]`).remove();
    }
    const attr_id = 'id="' + (options.id || `sfx_bubble_note_${++bubble_note_anon_count}`) + '"';
    const attr_style = options.style ? ` style="${options.style}"` : '';
    const attr_class = ` class="sfx_bubble_note sfx_bubble_note_${options.position}` +
        (options.no_esc ? ' sfx_bubble_note_no_esc' : '') +
        (options.className ? ` ${options.className}` : '') + '"';
    const c = X(`<div ${attr_id}${attr_style}${attr_class}>` +
        (options.close ? '<div class="sfx_sticky_note_close"></div>' : '') +
        (options.title ? `<div class="sfx_bubble_note_title">${options.title}</div>` : ''));
    // Bubble note content is generated entirely from within code and is untainted - safe
    c.append(typeof content === 'string' ? `<div class="sfx_bubble_note_content">${content}</div>` : content);
    // Close functionality
    c.find('.sfx_sticky_note_close, .sfx_button_close').click(function() {
        if (typeof options.callback=="function") {
            options.callback(c);
        }
        c.remove();
    });

    FX.on_content_loaded(function() {
        X(document.body).append(c);
        if (options.draggable) {
            c.children().attr('draggable','false');
            X.draggable(c[0]);
        }
    });
    return c;
};
// Hide all bubble notes when ESC is pressed
X.subscribe('esc/pressed', () => {
    const cur_notes = X('.sfx_bubble_note:not(.sfx_bubble_note_no_esc)');
    if (cur_notes.length) {
        X.publish('esc/prevent');
        cur_notes.remove();
    }
});

// A popup that remembers not to show itself next time
const context_message = function(key,content,options) {
    options = options || {};
    X.storage.get('messages',{},function(messages) {
        if (typeof messages[key]=="undefined") {
            // Show the message
            // Add an option to not show the message in the future
            content += FX.oneLineLtrim(`
                <div style="margin:15px 0 15px 0;"><input type="checkbox" class="sfx_dont_show" checked> Don't show this message again</div>
                <div><input type="button" class="sfx_button sfx_button_close" value="OK, Got It"></div>
            `);
            options.close = true;
            options.id = "sfx_content_message_"+key;
            options.title = `<div class="sfx_info_icon">i</div>${options.title}`;
            options.style="padding-left:35px;";
            options.callback = function($popup) {
                if ($popup.find('.sfx_dont_show').prop('checked')) {
                    X.storage.set('messages',key,X.now(),function() {});
                }
            };
            return bubble_note(content,options);
        }
    },true);
};

// ========================================================
// Fix Comments
// ========================================================
X.ready('comment_button', function () {
  var title = 'Fix Enter In Comments, Replies & Chat';
  FX.add_option('comment_button', {title, order: 1, description: 'Use Enter to add a new line instead of submitting comments & replies.', default: false, live: maybe_ok});
  FX.add_option('comment_button_msgs', {title, order: 2, description: 'Use Enter to add a new line instead of submitting chat / messages.', default: false, live: maybe_ok});
  FX.add_option('comment_button_ctrl', {title, order: 3, description: 'Use Ctrl+Enter to submit comments, replies & chat / messages.', default: false, live: maybe_ok});
  FX.add_option('comment_button_emergency', {title, order: 4, description: 'Use alternate method (no Submit buttons; Ctrl+Enter submits).', default: false, live: maybe_ok});
  FX.add_option('comment_button_hint', {hidden: true, default: true});

  /* Changed settings might fix a failure mode, so let's try again */
  var fix_comments_failing = false;
  function maybe_ok() { fix_comments_failing = false; }

  FX.on_options_load(function () {
    var nested_enter_event = false;
    var nested_enter_count = 0;

    var dispatch_enter_event = function (e, $target, shiftKey) {
      // Set a timeout so if it fails, revert back to default behavior
      var saved_enter_count = nested_enter_count;
      setTimeout(function () {
        if (nested_enter_count > saved_enter_count) {
          return;  // It worked!
        }

        // Tell Fix Enter to stop trying; retract Submit buttons & messages
        fix_comments_failing = true;
        remove_all_comment_buttons();

        // Then alert the user and offer some proposed solutions
        var proposed_solution = (FX.option('comment_button_emergency')) ?
                                "disable all 'Fix Enter' options" :
                                "enable the 'Use alternate method' option";
        var proposed_limitation = (FX.option('comment_button_emergency')) ?
                                `For now, 'Enter' submits and 'Shift+Enter' makes new lines
(Facebook's normal behavior)` :
                                `Enter will add new lines, Ctrl+Enter will submit,
but there will be no visible comment/reply Submit button`;
        // 0-timeout to allow button/msg retraction to redraw
        setTimeout(function () {
          alert(`Message from Social Fixer: it looks like 'Fix Enter' is failing.

Please ${proposed_solution}, and watch
the Support group, socialfixer.com/support, for announcements.

No need to report it, you won't be the first.

${proposed_limitation}.`.replace(/\n/g,' \n')); // Opera ^C-to-copy omits newlines
        });
        X.support_note('comment_button', 'failing');
      }, 250);
      nested_enter_event = true;
      $target[0].dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true
          , cancelable: true
          , charCode: 0
          , code: 'Enter'
          , key: 'Enter'
          , keyCode: 13
          , shiftKey: shiftKey
          , which: 13
      }));
      nested_enter_event = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // Anchor-parent of an entire write-a-comment-or-reply box
    const comment_ancestor_selector = [
        '.S2F_outl_none.S2F_disp_flex',
    ].join(',');

    // Presence of one of these indicates the input text is empty
    const comment_empty_text_selector = [
        '[id*=placeholder]',
        '[aria-describedby*=placeholder]',
        '.S2F_font_400.S2F_fcs_col_ph',
        '.S2F_pos_abs.S2F_col_tx2',
    ].join(',');

    // Presence of this indicates an image, GIF, or sticker attachment
    // aria-label is 'Remove sticker' or similar
    const comment_attachment_selector = [
        '[role=button][aria-label].S2F_bg_bt2.S2F_bbl_rad50',
    ].join(',');

    const comment_is_empty = function($container) {
        const $comment_ancestor = $container.closest(comment_ancestor_selector);
        return (
            // has placeholder prompting to enter a comment
                ($comment_ancestor.find(comment_empty_text_selector).length != 0) &&
            // *and* does not have a 'Remove this [image | GIF | sticker]' button
                ($comment_ancestor.find(comment_attachment_selector).length == 0)
        );
    };

    // Chat input fields on both pop-unders & whole-page chat have
    // these characteristics (and will be separately checked for
    // 'word-wrap:break-word' in code).
    const chat_input_selector = [
        '.S2F_pos_abs ~ * .S2F_col_tx1',
    ].join(',');

    // The 'send a birthday message' form has its own special quirks
    const birthday_input_selector = [
        '[role=dialog] form *',
    ].join(',');
    const birthday_input_rejector = [
        '[role=presentation] *',
    ].join(',');

    // Two kinds of comment input field...
    const comment_input_selector = [
        '[sfx_post] [role=presentation] *',           // inline comment
        '[role=complementary] [role=presentation] *', // 'theater' mode sidebar
    ].join(',');

    const input_field_source = function($target) {
        if ($target.is(birthday_input_selector) && !$target.is(birthday_input_rejector)) {
            // Checked *before* messages, as this field also matches that test
            return 'birthday';
        } else if ($target.is(comment_input_selector)) {
            return 'comment';
        } else if ($target.is(chat_input_selector) &&
                   Object.values($target.css(['word-wrap','word-break'])).includes('break-word')) {
            // 'word-wrap:break-word' or 'word-break:break-word' is sometimes given
            // in a style= parameter rather than a class, so use .css() to detect it.
            return 'message';
        } else if (/events\/birthdays/.test(location.pathname)) {
            // Checked *after* pop-unders so pop-unders work on the birthdays page
            return 'birthday';
        }
        // Nothing we know about...
        return '';
    };
    SFX.pose({ input_field_source, });

    const maybe_remove = function(comment_id, force) {
        const $container = X(`[sfx_comment_id="${comment_id}"]`);
        if (force || comment_is_empty($container)) {
            $container.unbind('focusout', comment_button_data[comment_id].remove_callback);
            $container.removeAttr('sfx_comment_id');
            X(`[id="sfx_comment_button_${comment_id}"]`).remove();
            delete comment_button_data[comment_id];
        }
    };
    const remove_all_comment_buttons = function() {
        Object.keys(comment_button_data).forEach(comment_id => maybe_remove(comment_id, true));
    };

    var comment_button_data = {};
    SFX.pose({ comment_button_data, remove_all_comment_buttons, });

    var comment_button_actions = {
      "comment_button_options": function () {
        X.publish("menu/options", {"highlight_title": title});
      },
      "comment_button_hint_off": function () {
        X.storage.set("options", "comment_button_hint", false);
        X('.sfx_comment_button_hint').remove();
      },
      "dispatch_enter_event": dispatch_enter_event,
    };

    var comment_id = 0;

    X.capture(window, 'keydown', function (e) {
      // This handler is invoked for every input key; bail
      // out early if we have nothing to do...
      // [[[ ==>

      // ==> If we already know our events aren't getting through
      if (fix_comments_failing) {
        return;
      }

      // ==> If this is a nested call (we're on the dispatch chain for
      //    our own injected Enter keys!)
      if (nested_enter_event) {
        nested_enter_count++;
        return;
      }

      // Find the target of the keypress
      var $target = X.target(e, true);

      // ==> If this isn't an editable field
      if (!$target.is('[contenteditable=true][role=textbox]')) {
        return;
      }

      // ==> In emergency mode, just fiddle with shift-state of Enter
      // (no UI, and apply to all input fields of any type)
      if (FX.option('comment_button_emergency')) {
        if (e.keyCode == 13) {
          // Force Ctrl+Enter = submit, else no way to submit comment / reply!
          // Although chat/msgs have native FB submit button, act consistently.
          dispatch_enter_event(e, $target, !e.ctrlKey);
        }
        return;
      }

      // ==> Is this a comment or chat / messages field, or unknown?
      const comment_type = input_field_source($target);
      if (!comment_type) {
        return;
      }

      // <== ]]]

      var this_comment_id = $target.attr('sfx_comment_id');
      if (!this_comment_id) {
        while (X(`[sfx_comment_id="${comment_id}"]`).length) {
          ++comment_id; // skip in-use IDs
        }
        this_comment_id = comment_id++;
        $target.attr('sfx_comment_id', this_comment_id);
        comment_button_data[this_comment_id] = {
          comment_type,
          Xtarget: $target,   // can't use $ in Vue data property names
        };
      }
      const cbd = comment_button_data[this_comment_id];
      if (!cbd) {
        // This happens if >1 SFx running and another is handling this comment_id
        return;
      }

      // Communicate any option changes to Vue -- without triggering
      // any events if they *haven't* changed...
      ['comment_button','comment_button_ctrl','comment_button_hint','comment_button_msgs'].forEach(function(opt) {
        var opt_val = FX.option(opt);
        if (cbd[opt] != opt_val) {
          cbd[opt] = opt_val;
        }
      });
      // Only add our own Submit button to the post-comment/reply & birthday cases
      if (comment_type == 'comment' || comment_type == 'birthday') {
        var tabIndex = 9900 + 2 * this_comment_id;
        $target[0].tabIndex = tabIndex;
        var $note_container = $target.closest('form').parent();
        const comment_or_reply = (comment_type == 'birthday') ? 'Birthday Post'
            : $note_container.closest('[sfx_post] li').length ? 'Reply'
                                                              : 'Comment';

        if (!$note_container.find('[id^=sfx_comment_button_]').length) {
          // Wait a moment to see if this keystroke lands in the input buffer
          setTimeout(() => {
            if (!$note_container.find('[id^=sfx_comment_button_]').length && !comment_is_empty($target)) {
              var html = FX.oneLineLtrim(`
                <div id="sfx_comment_button_${this_comment_id}" class="sfx_clearfix">
                  <input v-if="comment_button" class="sfx_comment_button" type="button" value="Submit ${comment_or_reply}" title="${cbd.comment_button_ctrl ? 'Click or press Ctrl+Enter to Submit' : ''}" style="cursor:pointer;" tabIndex="${9901 + 2 * this_comment_id}" @click="dispatch_enter_event($event, Xtarget, false)">
                  <span v-if="!comment_button && comment_button_hint" class="sfx_comment_button_msg sfx_comment_button_hint">
                    Social Fixer can prevent Enter from submitting comments & replies!<br>
                    <a class="sfx_link" style="color:inherit;" @click="comment_button_options">
                      'Fix Enter' Options
                    </a>
                    &nbsp;&nbsp;
                    <a class="sfx_link" style="color:inherit;" @click="comment_button_hint_off">
                      Don't show this
                    </a>
                  </span>
                </div>
              `);
              cbd.remove_callback = (() => setTimeout(() => maybe_remove(this_comment_id), 0.2 * X.seconds));
              $note_container.bind('focusout', cbd.remove_callback);
              template($note_container[0], html, cbd, comment_button_actions);
            }
          }, 0.05 * X.seconds);
        }
      } else if (comment_type == 'message' && cbd.comment_button_msgs) {
        // Removed: no longer workable code to set the 'Send' button tooltip
        // to 'Enter adds new lines, [Press Ctrl+Enter or] Click here to send'
      }

      if (e.keyCode != 13 ||
          (comment_type != 'message' && !cbd.comment_button) ||
          (comment_type == 'message' && !cbd.comment_button_msgs)) {
        // let FB handle it normally
        return;
      }
      dispatch_enter_event(e, cbd.Xtarget, !(cbd.comment_button_ctrl && (e.ctrlKey || e.metaKey)));
    });
  });
});

// Comment Navigator for 2020 New Layout
//
// This is significantly better at expanding comments, and has a better
// user interface including realtime abort.
//
// However, it entirely lacks the 'highlight comments newer than' feature,
// as FB have made comment timestamps impossible to work with.

X.ready('comment_navigator_nl', function() {
    const title = 'Comment Navigator';
    FX.add_option('navigator_order', {title, description: "Try to set comment order to (e.g. 'All' or 'New')", type: 'text', default: ''});
    FX.add_option('navigator_watch', {title, description: 'Follow Comment Navigator while expanding', default: false, });
    FX.add_option('navigator_avoid', {title, description: 'Words to avoid clicking', type:'text', default:'\\bhide\\b'});
    FX.add_option('navigator_close_wait', {hidden: true, default: 15, });
    X.publish('post/action/add', {section: 'wrench', label: 'Expand Comments', order: 10, message: 'post/action/expand'});
    X.subscribe('post/action/expand', (msg, data) => expand_post(data.id));

    // A freshly displayed post may have no comments visible, just a '123 Comments' button
    const comment_exposer_selector = [
        '[role=button][aria-expanded=false] > .S2F_font_400',
        '[role=button][id] > .S2F_font_400',
    ].join(',');

    // Once comments are displayed, some posts have a widget to select comment
    // order, like 'All Comments', 'Most Recent', or 'Top Comments'
    const order_widget_selector = [
        '[role=button].S2F_disp_inl .S2F_alini_cent.S2F_va_mid',
    ].join(',');

    // Parent node which includes the name of the current sort order
    const order_widget_parent = [
        '[role=button]',
    ].join(',');

    // Differentiate individual menu items within the order widget
    const order_menuitem_selector = [
        '[role=menu] [role=menuitem] .S2F_col_tx1',
    ].join(',');

    // Count comments currently displayed (info only)
    const comment_selector = [
        '[role=article]',
    ].join(',');

    // The main event!  These are the various buttons which will fully expand a post.
    const expander_selector = [
        // 'See More'
        '[dir=auto] .S2F_col_tx1.S2F_font_600.S2F_touch_man[role=button]:not(.S2F_alini_stre)',
        // 'N [more] comments/replies'
        ':not(.S2F_left_0)+[role=button].S2F_col_tx2 > span > [dir]',
    ].join(',');
    // This filters out some false matches like '3 others' and 'See Translation'
    const expander_rejector = [
        'h2 *',
        'h3 *',
        'h4 *',
        'h5 *',
        'strong *',
    ].join(',');

    // A specific and then a generic fallback for the popup's close box
    const popup_closebox_selector_1 = [
        '.S2F_bg_bt2.S2F_bbl_rad50[role=button]',
    ].join(',');
    const popup_closebox_selector_2 = [
        '[aria-label][role=button]',
    ].join(',');

    var exp_serial = 1;
    const exps = {};
    SFX.pose({ expand_comments_data: exps, });

    const exp_done = function(exp) {
        if (exp.state != 'FINISH') {
            exp.state = 'FINISH';
            exp.$note.remove();
            // Activate the post body so ESC will close popup
            exp.$post.click();
            delete exps[exp.serial];
        }
    };

    const exp_reacts_to_esc = function() {
        Object.values(exps).forEach(exp => {
            X.publish('esc/prevent');
            if (exp.state == 'EXPAND') {
                show_stats(exp, 'TIMER', 'red');
                progress(exp, 'ESC pressed, stopping comment expansion');
            } else {
                exp_done(exp);
            }
        });
    };
    X.subscribe('esc/pressed', exp_reacts_to_esc);

    const exp_reacts_to_new_post = function(msg, data) {
        if (!data || !data.$post || data.$post[0].getRootNode() != document) {
            return;
        }
        Object.values(exps).forEach(exp => {
            if (exp.$post.attr('sfx_id') == data.sfx_id) {
                if (exp.popup_seen) {
                    // Multiple popups; close this new one
                    var $close = data.$post.find(popup_closebox_selector_1);
                    if (!$close.length) {
                        $close = data.$post.find(popup_closebox_selector_2);
                    }
                    if (!$close.length) {
                        progress(exp, 'CANNOT FIND CLOSE BOX of excess popup');
                        progress(exp, 'You will have to close it manually');
                    } else {
                        progress(exp, 'Closing excess popup');
                        $close.first().click();
                    }
                    return;
                }
                exp.popup_seen = true;    // For rest of expansion: close excess popups
                exp.popup_popped = true;  // For the moment: retry expose & order menu
                progress(exp, 'Moving expansion to comments popup');  // Logs in parent post's Post Data
                exp.$orig_post = exp.$post;
                exp.$post = data.$post;
                exp.dom_id = data.id;
                exp.patience += 2.0;
                progress(exp, 'Now expanding in the comments popup');   // Logs in popup post's Post Data
            }
        });
    };
    X.subscribe_backlog('post/add', exp_reacts_to_new_post);

    const run_time = (exp => ((performance.now() - exp.start) / X.seconds).toFixed(3));

    const progress = function(exp, message) {
        message = message.replace(/[ ><\s]+/g, ' ');
        exp.$log.scrollingAppend(`<br><span style="color:${exp.color}">${run_time(exp)} ${message}</span>`);
        X.publish('log/postdata', {id:exp.dom_id, message});
    };

    const show_stats = function(exp, new_state, new_color) {
        if (new_state) exp.state = new_state;
        if (new_color) exp.color = new_color;
        exp.comments = exp.$post.find(comment_selector).length;
        const ret = `${run_time(exp)}s, ${exp.clicks} clicks, ${exp.comments} comments -- ${exp.state}`;
        exp.$stats.text(ret).css('color', exp.color);
        return ret;
    };

    const enclick = function(exp, button, msg) {
        const button_text = button.innerText;
        const $button = X(button);
        if ((FX.option('navigator_avoid') && RegExp(FX.option('navigator_avoid'), 'i').test(button_text))) {
            if (!$button.hasClass('sfx_click_avoided')) {
                $button.addClass('sfx_click_avoided');
                progress(exp, `Avoiding '${button_text}' as directed`);
            }
            return false;
        }
        if (!msg && button_text) {
            msg = `Clicking '${button_text}'`;
        }
        progress(exp, msg);
        $button.click();
        ++exp.clicks;
        show_stats(exp);
        return true;
    };

    const display_expand = function(exp) {
        const content = X(FX.oneLineLtrim(`
            <label>
                <h2 style="position:absolute;top:calc(2.1rem * var(--sfx_ui_scale));right:calc(0.5rem * var(--sfx_ui_scale))">
                    Close after&nbsp;
                    <input class="sfx_input" type="number" min="0" value="${FX.option('navigator_close_wait')}" style="width: calc(1.75rem * var(--sfx_ui_scale));" sfx-option="navigator_close_wait">
                    s
                </h2>
            </label>
            <label>
                <h2 style="position:absolute;top:calc(2.8rem * var(--sfx_ui_scale));right:calc(0.7rem * var(--sfx_ui_scale));">
                    Follow expansion
                    <input class="sfx_input" type="checkbox" value="${FX.option('navigator_watch')}" sfx-option="navigator_watch">
                </h2>
            </label>
            <div class='sfx_expander_stats'></div>
            <div class='sfx_expander_ui'></div>
        `));
        const title = `Social Fixer: Expanding post ${exp.dom_id}`;
        // Handle our own ESC processing: 1st ESC stops expanding, 2nd ESC closes window
        exp.$note = bubble_note(content, {title, position:'top_right', no_esc:true, close:true, callback:function() { exp_done(exp); }});
        exp.$note.find('.sfx_sticky_note_close')
                 .css({ width: 'auto', height: 'auto', })
                 .addClass('sfx_button')
                 .text('ESC to stop');
        FX.attach_options(exp.$note);
        exp.$log = exp.$note.find('.sfx_expander_ui');
        exp.$stats = exp.$note.find('.sfx_expander_stats');
        progress(exp, `Begin expanding post ${exp.dom_id}`);
        show_stats(exp);
    };

    // 'func' should return 0 for condition not met;
    // nonzero for met, and that value will be returned;
    // returning -1 means failure, caller should just return.
    // if msg exists, condition not met is considered a failure
    const try_for = async function(exp, patience, func, msg) {
        var result;
        do {
            if (exp.state != 'EXPAND') return -1;
            if ((result = func())) return result;
            await X.sleep(0.2);
            patience -= 0.201;
        } while (patience > 0);
        if (!(result = func())) {
            if (msg) {
                progress(exp, msg);
                return -1;
            }
        }
        return result;
    };

    const expose_comments = async function(exp) {
        const $comment_exposer = exp.$post.find(comment_exposer_selector);
        if (!exp.comments && $comment_exposer.length) {
            enclick(exp, $comment_exposer[0], `Clicking '${$comment_exposer[0].innerText}' to expose post comments`);
            exp.patience = 1.0;
        } else {
            progress(exp, 'Comments are already visible');
        }
    };

    const choose_order = async function(exp) {
        const my_patience = exp.patience + 0.1;
        const order_request = FX.option('navigator_order').trim();
        if (!order_request) {
            return progress(exp, 'No specific comment order is requested');
        }
        const order_regexp = new RegExp(order_request, 'i');
        var $order_menu = [];
        exp.patience = 0;
        if (-1 == await try_for(exp, my_patience,
            () => ($order_menu = exp.$post.find(order_widget_selector).closest(order_widget_parent)).length,
            'No comment order menu found')) return;
        if ($order_menu[0].innerText.match(order_regexp)) {
            progress(exp, `Order '${$order_menu[0].innerText}' already matches '${order_request}'`);
            return;
        }
        if (!enclick(exp, $order_menu[0], `Clicking order menu (currently '${$order_menu[0].innerText}')`)) {
            return;
        }
        var $menuitems = X([]);
        if (-1 == await try_for(exp, 0.5,
            () => (($menuitems = X(order_menuitem_selector)).length))) return;
        var clicked = false;
        $menuitems.each(function() {
            const menuitem = this.innerText;
            if (menuitem.match(order_regexp)) {
                if (enclick(exp, this, `Menu item '${menuitem}' matches '${order_request}', clicking`)) {
                    clicked = true;
                    exp.patience = 2.0;
                    return false; // Break each()
                }
            } else {
                progress(exp, `Menu item '${menuitem}' does not match '${order_request}', skipping`);
            }
            return true; // Continue each()
        });
        if (!clicked) {
            enclick(exp, $order_menu[0], `Clicking order menu to put it away`);
        }
    };

    // Returns expand_cycle so cycle count can be consistent across popups
    const expand_comments = async function(exp) {
        var cycle_patience = 1.0;
        var expand_cycle = 0;
        var expand_count = true;
        const activity = [];
        const max_flails = 5;
        var expanders, prev_expanders = [];
        while (expand_count && exp.state == 'EXPAND' && !exp.popup_popped) {
            var my_patience = exp.patience;
            exp.patience = 0;
            expand_count = 0;
            if (-1 == await try_for(exp, cycle_patience + my_patience, function() {
                my_patience = 0;
                expanders = exp.$post.find(expander_selector).not(expander_rejector);
                if (expanders.length == 0 && expand_cycle > 2) {
                    // No expanders early can mean we're waiting for exposure or
                    // change of order.  Later it always means 'done' since the
                    // expander buttons stay present until their action is done.
                    return -1;
                }
                if (expanders.length == prev_expanders.length &&
                    (expanders.toArray().every((ex,idx) => ex == prev_expanders[idx]))) {
                        return 0; // Nothing changed
                }
                prev_expanders = expanders;
                return expanders.length;
            })) break;
            ++expand_cycle;
            show_stats(exp);
            progress(exp, `Cycle ${expand_cycle + exp.saved_cycles}, expanding: ${expanders.length} (${exp.comments} comments visible)`);
            for (const expander of expanders.toArray()) {
                if (exp.state == 'EXPAND' && expander.getRootNode() == document && enclick(exp, expander, '')) {
                    ++expand_count;
                    X(expander).addClass('sfx_clicked');
                    if (FX.option('navigator_watch')) {
                        expander.scrollIntoView(false);
                    }
                    if (exp.popup_popped) {
                        progress(exp, 'Popup popped up, restarting expansion');
                        return expand_cycle;
                    }
                    await X.sleep(0.1);
                }
            }
            show_stats(exp);
            activity[expand_cycle] = exp.comments + expand_count;
            // Go slower if nothing is happening; '50 more comments' takes a while, no point in hammering.
            if (activity[expand_cycle - 1] == activity[expand_cycle]) {
                cycle_patience = Math.min(cycle_patience + 0.5, 8.0);
            }
            // Give up completely if too many cycles have gone by with no changes.
            if (activity[expand_cycle - max_flails] == activity[expand_cycle]) {
                show_stats(exp, 'FB STALL', 'red');
                progress(exp, `cycle ${expand_cycle}, no activity in ${max_flails} cycles, stopping`);
                exp.color = 'green';
                progress(exp, `(you can use Expand Comments again to keep trying)`);
            }
        }
        return expand_cycle;
    };

    const expand_post = async function(dom_id) {
        var exp = {
            dom_id,
            start: performance.now(),
            $post: X('#' + dom_id),
            state: 'EXPAND',
            serial: exp_serial,
            patience: 0,
            clicks: 0,
            comments: 0,
            color: 'black',
            saved_cycles: 0,
        };
        exps[exp_serial++] = exp;
        display_expand(exp);
        do {
            exp.popup_popped = false;
            await expose_comments(exp);
            await choose_order(exp);
            exp.saved_cycles += await expand_comments(exp);
        } while (exp.popup_popped);
        if (exp.state == 'EXPAND') {
            progress(exp, show_stats(exp, 'DONE', 'green'));
        }
        exp.$note.find('.sfx_sticky_note_close').text('ESC to close');
        progress(exp, `ESC to close, or auto-close in ${FX.option('navigator_close_wait')} seconds`);
        exp.$post.find('.sfx_clicked').removeClass('sfx_clicked');
        if (exp.$orig_post) {
            exp.$orig_post.find('.sfx_clicked').removeClass('sfx_clicked');
        }
        if (FX.option('navigator_watch')) {
            exp.$post[0].scrollIntoView(true);
            setTimeout(() => window.scrollBy(0, -150));
        }
        X.sleep(FX.option('navigator_close_wait') || 0.5).then(function() {
            if (exp.$note.probe(':hover,:active,:focus').length) {
                show_stats(exp, 'WAIT', 'red');
                progress(exp, 'Wait for user interaction -- ESC to close');
            } else {
                exp_done(exp);
            }
        });
    };
});

// =====================================
// Control Panel operations
// =====================================
X.ready( 'control_panel', function() {
    FX.add_option('control_panel_x', {"hidden": true, "default": 0});
    FX.add_option('control_panel_y', {"hidden": true, "default": 50});
    FX.add_option('control_panel_right', {"hidden": true, "default": false});
    FX.add_option('control_panel_bottom', {"hidden": true, "default": false});
    FX.add_option('reset_control_panel_position', {"title": ' Control Panel', "section": "Advanced", "description": "Reset the position of the Control Panel to the upper left", "type": "action", "action_text": "Find Control Panel", "action_message": "cp/reset_position"});

    var control_panel_created, control_panel_displayed, control_panel_always = false;

    SFX.cp_selector = `[id=sfx_control_panel].${SFX.instance}`;
    var data;
    var reset = function () {
        X(SFX.cp_selector).remove();
        data = {
            "sections": []
        };
        control_panel_created = false;
        control_panel_displayed = false;
        SFX.pose({ cp_sections: data.sections,
                   cp_created: control_panel_created,
                   cp_displayed: control_panel_displayed,
                   cp_always: control_panel_always,
                });
    };
    reset();

    const close_cp = function () {
        control_panel_always = false;
        X.publish('cp/hide');
    };

    // Reset the position
    X.subscribe("cp/reset_position", function () {
        if (!control_panel_displayed) {
            X.publish('cp/show');
        } else if (!data.sections.length) {
            bubble_note(
                FX.oneLineLtrim(`
                    No posts have yet been filtered to a Social Fixer tab.<br>
                    The Control Panel will appear if a post is filtered.<br><br>
                    The following options turn on the CP permanently:<br><br>
                    - General > Mark All Read / Undo<br>
                    - Advanced > Always Show Tab List
                `), {title: 'No posts filtered yet', close: true});
        } else {
            FX.option('control_panel_x', null, false);
            FX.option('control_panel_y', null, false);
            FX.option('control_panel_right', null, false);
            FX.option('control_panel_bottom', null, false);
            X.storage.save("options");
            position_control_panel(null, null, false);
        }
    });

    // Add a SECTION
    X.subscribe("cp/section/add", function (msg, section_data) {
        if (!data.sections.some(sect => sect.id == section_data.id)) {
            create_control_panel();
            section_data.order = section_data.order || 999;
            // {"name", "id", "help", "order"}
            data.sections.push(section_data);
        }
    });
    X.subscribe('cp/hide', () => ((control_panel_displayed = false), X(SFX.cp_selector).hide()));
    X.subscribe('cp/show', () => ((control_panel_displayed = true),  X(SFX.cp_selector).show()));
    X.subscribe('cp/always_show', () => ((control_panel_always = true), X.publish('cp/show')));

    var create_control_panel = function () {
        if (control_panel_created || X.find(SFX.cp_selector)) {
            return;
        }

        // Don't create the control panel on some pages
        if (/\/memories\//.test(location.href) || /\/messages\//.test(location.href)) {
            return;
        }

        control_panel_created = true;

        var html = FX.oneLineLtrim(`<div id="sfx_control_panel" class="${SFX.instance}" style="display:none">
                <div class="sfx_cp_header" v-tooltip="{icon:false,content:'The Social Fixer Control Panel (CP) may contain filter tabs and controls such as Mark All Read &amp; Undo. Click X to disable associated features and hide it. Drag to move.',delay:750}"><span @click="close_cp" class='sfx_cp_close_button'>X</span>SFX Control Panel</div>
                <div class="sfx_cp_data">
                    <div class="sfx_cp_section" v-for="section in sections | orderBy 'order'">
                        <div class="sfx_cp_section_label" v-tooltip="{content:section.help,position:'right',delay:300}">{{{section.name}}}</div>
                        <div class="sfx_cp_section_content" id="{{section.id}}"></div>
                    </div>
                </div>
            </div>
            `);
        var actions = { close_cp };
        template(document.body, html, data, actions).ready(function () {
            // Position it
            position_control_panel(null, null, false);

            // Make it draggable
            X.draggable(SFX.cp_selector, function (el, x, y) {
                position_control_panel(x, y, true);
            });
        });
        if (control_panel_always) {
            X.publish('cp/show');
        }
    };
    var position_control_panel = function (x, y, save) {
        var $cp = X(SFX.cp_selector);
        if (!$cp.length) {
            return;
        }
        var right = FX.option('control_panel_right');
        var bottom = FX.option('control_panel_bottom');
        var snap_tolerance = 15;
        var reposition = false;
        if (typeof x == "undefined" || x == null || typeof y == "undefined" || y == null) {
            // Re-position it with saved options
            x = +FX.option('control_panel_x');
            y = +FX.option('control_panel_y');
            reposition = true;
        }
        var h = $cp[0].offsetHeight;
        var w = $cp[0].offsetWidth;

        // Constrain it to the screen
        if (x < 1) {
            x = 1;
        }
        if (!reposition) {
            right = (window.innerWidth && x + w > (window.innerWidth - snap_tolerance)); // Off the right side, snap it to the right
        }
        if (y < 40) {
            y = 40;
        }
        if (!reposition) {
            bottom = (window.innerHeight && y + h > (window.innerHeight - snap_tolerance)); // Off the bottom, snap to bottom
        }

        // Position it
        if (right) {
            $cp.css({'right': 0, 'left': ''});
        }
        else {
            $cp.css({'left': x, 'right': ''});
        }
        if (bottom) {
            $cp.css({'bottom': 0, 'top': ''});
        }
        else {
            $cp.css({'top': y, 'bottom': ''});
        }

        // Persist the control panel location
        if (false !== save) {
            FX.option('control_panel_x', x, false);
            FX.option('control_panel_y', y, false);
            FX.option('control_panel_right', right, false);
            FX.option('control_panel_bottom', bottom, false);
            X.storage.save("options");
        }
    };
    // On window resize, make sure control panel is on the screen
    X(window).resize(function () {
        position_control_panel();
    });
    // When the page unloads to navigate, remove the control panel
    X.subscribe_backlog('posts/reset', reset);
});

X.ready('debug_insertion_order', function() {
    FX.add_option('debug_show_insertion_order', {"section":"Debug", "title": 'Show Insertion Order', "description": "Highlight portions of posts that are lazily inserted after the post appears on the page.", "default": false});
    FX.on_option('debug_show_insertion_order', function() {
        FX.on_content_inserted(function ($o) {
            var insertion_step = $o.closest('.sfx_inserted').attr('sfx_step') || 0;
            insertion_step++;
            $o.attr('sfx_step', insertion_step);
            $o.addClass("sfx_insert_step_" + insertion_step);
            $o.addClass("sfx_inserted");
        });
    });
});


X.ready( 'debug_post_html', function() {
    // Add an item to the wrench PAI
    X.publish('post/action/add', {"section": "wrench", "label": "Show Post HTML", order: 30, "message": "post/action/post_html"});
    X.subscribe("post/action/post_html", function (msg, data) {
        const html_text = X.htmlEncode(document.getElementById(data.id).outerHTML);

        var content = FX.oneLineLtrim(`
        <div draggable="false">Click in the box, press ${SFX.Ctrl}+a to select all, then ${SFX.Ctrl}+c to copy.</div>
        <div draggable="false">
            <textarea style="white-space:pre-wrap;width:500px;height:250px;overflow:auto;background-color:white;">${html_text}</textarea>
        </div>
        `);
        bubble_note(content, {"position": "top_right", "title": "Post Debug HTML", "close": true});
    });
});

// As 'post/update' is gone, this doesn't really do anything any more
// But changes post appearance, so let it stand in case someone got used to it

X.ready('debug_post_update_tracking', function() {
    FX.add_option('debug_post_update_tracking', {"section":"Debug", "title": 'Track Post Updates', "description": "Track how often a post receives DOM updates and display the timing", "default": false});
    FX.on_option('debug_post_update_tracking', function() {
        X.subscribe_backlog('post/add', function(msg,data) {
            var now = performance.now();
            const $post = data.$post;
            var size = $post.innerText().length;

            $post.attr('sfx_update_count','0');
            $post.attr('sfx_update_start',now);
            $post.attr('sfx_update_size',size);
            $post.attr('sfx_update_tracking','');
        });
    });
});

// ========================================================
// Provide a View Log option
// ========================================================
X.ready('debugger', function () {
  var log = X.logger('debugger');

  var viewer = null;
  var query = null;
  var property = null;
  var results = null;
  var delay = 0;

  X.publish("menu/add", {"section":"other", "item":{'html': 'Debugger', 'message': 'debugger/open'}});
  X.subscribe("debugger/open", function() {
    log("Debugger opened");
    show();
  });

  function sanitize_selector(str) {
    return str.replace(/[^\w\d -.#():^~*$"=[\]|]/g,'');
  }
  FX.on_content_loaded(function() {
    var launch = false, str=null;
    if (/sfx_debugger_query=([^&]+)/.test(location.href)) {
      str = decodeURIComponent(RegExp.$1);
      // Sanitize
      str = sanitize_selector(str);
      log("Debugger Query set through url: "+str);
      apply_query(str);
      launch = true;
    }
    if (/sfx_debugger_property=([^&]+)/.test(location.href)) {
      str = decodeURIComponent(RegExp.$1);
      // Sanitize
      str = str.replace(/[^\w\d-]/g,'');
      log("Debugger Property set through url: "+str);
      apply_property(str);
      launch = true;
    }
    if (/sfx_debugger_delay=([^&]+)/.test(location.href)) {
      var ms = +decodeURIComponent(RegExp.$1);
      log("Debugger delay set through url: "+str);
      delay = ms;
    }
    if (launch) {
      setTimeout(function() {
        show();
        run();
      },delay);
    }
  });

  var show = function() {
    create_debugger();
    viewer.show();
  };

  var create_debugger = function() {
    if (viewer) { return; }
    viewer = X(FX.oneLineLtrim(`
      <div id="sfx_debugger">
        <div class="sfx_dialog_title_bar" style="margin:0;">
          <div class="sfx_debugger_button" id="sfx_debugger_close">X</div>
          Social Fixer Debugger
        </div>
        <div id="sfx_debugger_controls">
          <div>CSS Query: <input id="sfx_debugger_query" value=""></div>
          <div>Computed CSS Property: <input id="sfx_debugger_property" value=""></div>
          <div>
            <input type="button" class="sfx_button" value="Run" id="sfx_debugger_run">
            <span id="sfx_debugger_url"></span>
          </div>
        </div>
        <div id="sfx_debugger_results"></div>
      </div>
    `));
    X('body').append(viewer);
    results = X('#sfx_debugger_results');
    X("#sfx_debugger_run").click(function() {
      run();
    });
    X("#sfx_debugger_close").click(function() {
      viewer.hide();
    });
    X("#sfx_debugger_query").val(query).change(function(e) {
      apply_query(X.target(e).value);
    });
    X("#sfx_debugger_property").val(property).change(function(e) {
      apply_property(X.target(e).value);
    });
  };
  var apply_query = function(str) {
    query = (str||'').trim();
  };
  var apply_property = function(str) {
    property = (str||'').trim();
  };

  var run = function() {
    results.html('');
    var els = null;
    if (!query) {
      return results.html('No query');
    }
    try {
      els = X.query(query);
    }
    catch(e) {
      return results.html('Query error: '+e.message);
    }
    if (!els.length) {
      return results.html('No results found');
    }

    // Valid query, update the url
    var url = location.href.replace(/&.*/,'');
    url += /\?/.test(url) ? '&' : '?';
    url += "sfx_debugger_query="+encodeURIComponent(query);
    if (property) {
      url += "&sfx_debugger_property=" + encodeURIComponent(property);
    }
    X('#sfx_debugger_url').html(`<a href="${url}">${url}</a>`);

    var count = 0;
    var count_limit = 100;
    var i, j, empty = false, $d=null, $d2=null, $content=null;
    var header = function(type) {
      // Each element of the returned array is an X collection, or possibly a string
      var $header = X(`<div class="sfx_debugger_text_header"></div>`);
      $header.text(type);
      var $action = X(`<span class="sfx_debugger_action">Copy</span>`);
      $action.on('click',function(e) {
        X(e.target.parentNode.nextSibling).select(true);
        return false;
      });
      $header.append($action);
      return $header;
    };
    for (i=0; i<els.length && count<count_limit; i++) {
      //str.push(X(els[i]).tagHTML());
      empty = true;
      $d = X('<div class="sfx_debugger_result sfx_clearfix">');
      if (typeof els[i]==="string") {
        if (++count<count_limit) {
          $content = X(`<div class="sfx_debugger_content sfx_debugger_text_content">`);
          $content.text(els[i]);

          $d.append(header('[Text]'));
          $d.append($content);
          empty = false;
        }
      }
      else {
        var inner_els = els[i];
        for (j=0; j<inner_els.length; j++) {
          if (++count<count_limit) {
            empty = false;
            $d2 = X('<div class="sfx_debugger_subresult sfx_clearfix">');

            $content = X(`<div class="sfx_debugger_content sfx_debugger_node_content">`);
            $content.text(X(inner_els[j]).tagHTML());

            $d2.append(header('[Node]'));
            $d2.append($content);

            (function(el) {
              $d2.on('mouseover',function() {
                el.style.outline = "3px solid blue";
              });
              $d2.on('mouseout',function() {
                el.style.outline = "";
              });
              $d2.on('click',function() {
                viewer.hide();
                el.scrollIntoView(false);
                setTimeout(function() {
                  el.style.outline="10px solid blue";
                },500);
                setTimeout(function() {
                  el.style.outline="";
                },3000);
              });
            })(inner_els[j]);
            $d.append($d2);
          }
        }
      }
      if (!empty) {
        results.append($d);
      }
    }
    if (count>=count_limit) {
      results.prepend(`<div class="sfx_debugger_warning">Result count exceeds limit. Showing the first ${count_limit}.</div>`);
    }
  };
});

X.ready( 'disable_tooltips', function() {
    FX.add_option('disable_tooltips', {"title": 'Disable Tooltips', "section": "Advanced", "description": "If you are an Advanced user and no longer need to see the helpful tooltips that pop up when hovering over some things, you can entirely disable them here.", "default": false});

    FX.on_options_load(function () {
        if (FX.option('disable_tooltips')) {
            Vue.directive('tooltip', function (/* newValue, oldValue */) {
            });
        }
    });
});

// ========================================================
// Display Tweaks
// ========================================================
X.ready( 'display_tweaks', function() {
	FX.add_option('tweaks_enabled', {
		"section": "Display Tweaks"
		, "hidden": true
		, "default": true
	});
	FX.on_options_load(function () {
		var tweaks = FX.storage('tweaks');
		if (!tweaks || !tweaks.length || !FX.option('tweaks_enabled')) {
			return;
		}
		for (var i = 0; i < tweaks.length; i++) {
			if (X.isObject(tweaks[i]) && tweaks[i].enabled && !tweaks[i].disabled) {
				X.css(tweaks[i].css, 'sfx_tweak_style_' + i);
			}
		}
	});
});

X.ready( 'donate', function() {
    FX.add_option('sfx_option_show_donate2',
        {
            "section": "Advanced"
            , "title": 'Show Donate Message'
            , "description": 'Show a reminder every so often to support Social Fixer development through donations.'
            , "default": true
        }
    );
    FX.on_options_load(function () {
        // Before showing the donate message, wait at least 5 days after install to not annoy people
        X.storage.get('stats', {}, function (stats) {
            if (stats && stats.installed_on && (X.now() - stats.installed_on > 5 * X.days) && X.userid != "anonymous") {
                X.task('sfx_option_show_donate', 30 * X.days, function () {
                    if (FX.option('sfx_option_show_donate2')) {
                        X.when(SFX.badge_sel, function () {
                            X.publish("menu/options", {"section": "Donate", "data": {"sfx_option_show_donate": true}});
                        });
                    }
                });
            }
        }, true);
    });
});

X.ready('edit_buffer', function() {
    FX.add_option('edit_buffer', {
        section: 'Experiments',
        title: 'Find Edit',
        description: 'Find unsaved post / comment / reply edits.',
        type: 'action',
        action_message: 'options/close,edit_buffer/find',
        action_text: 'Find Edit In Progress',
    });

    // This still includes the selector for old layout, which I think
    // may still be used on some hybrid page types
    const substream_selector = [
            '[data-pagelet*=FeedUnit]',
            '[role=feed]',
            '[id^="substream"]',
            '[sfx_post]',
    ].join(',');

    // This selector finds edit buffers on both old-new-layout and
    // new-new-layout (change happening mid-June 2021)
    const buf_selector = [
            '[contenteditable=true]',
            // This is the edit-a-post buffer at the top of one's feed
            '[role=region] [aria-label] ~ [role=button].S2F_bg_cbg .S2F_col_tx1',
    ].join(',');

    // The prompt text like 'Write a comment...' is marked [contenteditable=false]
    const buf_rejector = [
            '[contenteditable=false]',
    ].join(',');

    var edit_buf_scrollto = function(buf) {
        var $buf = X(buf);

        // Multi-level scrolling was required on Opera and probably all
        // Chromium / Blink / WebKit; if I don't scroll to 'substream'
        // first, it can't find 'buf' and doesn't scroll at all.  Final
        // scroll is to put it in the middle of the screen.

        $buf.parents(substream_selector).toArray().reverse().forEach( el => el.scrollIntoView() );
        setTimeout(() => window.scrollTo(0, $buf.offset().top - (window.innerHeight / 2)), 10);
    };

    X.subscribe('edit_buffer/find', function () {
        var prev_buf = -1;

        // Let's put posts back how we found them
        const saved_post_classes = {};
        const force_visible_classes = 'sfx_edit_buf_post_show sfx_show_read sfx_filter_hidden_show';
        const force_post_visibility = function ($post, force_visible) {
            if ($post[0]) {
                const id = $post[0].id;
                if (force_visible && !saved_post_classes[id]) {
                    saved_post_classes[id] = force_visible_classes.split(' ').filter(cl => $post.hasClass(cl)).join(' ');
                    $post.addClass(force_visible_classes);
                } else if (!force_visible) {
                    $post.removeClass(force_visible_classes);
                    if (id in saved_post_classes) {
                        $post.addClass(saved_post_classes[id]);
                        delete saved_post_classes[id];
                    }
                }
            }
        };

        var show_edit_buf_post = function (buf_num, is_selected) {
            if (buf_num == -1) {
                X('.sfx_edit_buf_post_show').forEach(post => force_post_visibility(X(post), false));
                return;
            }
            // Highlight the selection in our menu
            X(`#sfx_find_edit_dialog [_option_="${buf_num}"]`).toggleClass('sfx_edit_buf_selected', is_selected);

            // If selected buffer is in a post, highlight that post
            // and force it to be visible even if 'Read', hidden by
            // filter action, or in a non-current tab.
            force_post_visibility(X(dirty_buffers[buf_num]).closest('[sfx_post]'), is_selected);
        };
        var select_buf = function (e) {
            var buf_num = X(e.target).attr('_option_');
            show_edit_buf_post(prev_buf, false);
            show_edit_buf_post(buf_num, true);
            edit_buf_scrollto(dirty_buffers[buf_num]);
            prev_buf = buf_num;
        };
        var close_dialog = function () {
            if (!vue_variables.leave_visible) {
                show_edit_buf_post(-1, false);
            }
            X('#sfx_find_edit_dialog').remove();
        };
        var row_content = function (db) {
            var row = X(db).innerText();
            return (row.length == 0) ? '&middot;'
                 : (row.length < 80) ? X.htmlEncode(row)
                                     : X.htmlEncode(row.slice(0, 76)) + '...';
        };

        var dirty_buffers = X(buf_selector).filter(function() {
            return (this.innerText.length > 0 && this.innerText != '\n' && !X(this).probe(buf_rejector).length);
        });
        SFX.pose({ active_buffers: dirty_buffers, });
        var db_l = dirty_buffers.length;
        var click_msg = (db_l == 0) ? 'No edits in progress' :
                        (db_l == 1) ? 'Click to show this edit' :
                                      'Click to show one of these edits';

        var html = FX.oneLineLtrim(`
            <div class="sfx_bubble_note sfx_bubble_note_top_right" draggable="true" id="sfx_find_edit_dialog">
                <div class="sfx_bubble_note_title">
                    Find Edit In Progress
                </div>
                <div>
                    ${click_msg}
                </div>
                <br>
                <template v-for="db in dirty_buffers">
                    <template v-if="db.innerText">
                        <div @click="select_buf" draggable="false" _option_="{{$index}}" class="sfx_edit_buf_button">
                            {{{row_content(db)}}}
                        </div>
                        <br>
                    </template>
                </template>
                <span draggable="false">
                    <input type="button" class="sfx_button" value="Done" @click="close_dialog">
                </span>
                <label class="sfx_edit_buf_toggle" @click="leave_visible = !leave_visible"
                       title="Show editing post even if 'Read' / hidden / in other tab">
                    <input type="checkbox" class="sfx_button">
                    Leave post highlighted
                </label>
            </div>
        `);
        var vue_variables = {
            dirty_buffers,
            leave_visible: false,
        };
        var vue_methods = {
            row_content,
            select_buf,
            close_dialog,
        };

        template(document.body, html, vue_variables, vue_methods).ready(function () {
            X.draggable('#sfx_find_edit_dialog');
        });
    });
});

// Distribute a message when ESC is pressed
window.addEventListener('keydown', event => {
    if (event.keyCode == 27) {
        SFX.prevent_esc = false;
        X.publish('esc/pressed');
        if (SFX.prevent_esc) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
}, { capture: true, });

X.subscribe('esc/prevent', () => SFX.prevent_esc = true);

// =========================================================
// External CSS
// =========================================================
X.ready( 'external_css', function() {
    // XXX This should have a 'Test' button to immediately request it,
    // report if it's (1) missing, (2) not HTTPS (or bad certificate
    // chain blah blah), or (3) not mime type text/css.
    // OR: automatically test whenever changed...
    FX.add_option('external_css_url', {"section": "Advanced", "type": "text", "title": 'External CSS url', "description": 'URL of external CSS to be included in the page.  NOTE: browser may require HTTPS, and that server presents MIME type text/css.', "default": ""});
    FX.on_options_load(function () {
        var url = X.sanitize(FX.option('external_css_url'));
        if (url) {
            X.when('head', function ($head) {
                $head.append(`<link id="sfx_external_css" rel="stylesheet" type="text/css" href="${url}">`);
            });
        }
    });
});

// Collect anti-CSRF token (DTSG) as early as possible.

// (a) determine if we in fact 'got' dtsg (is it non-blank?);
// (b) issue proclamations if so (FX.dtsg & 'fb_dtsg/ready');
// (c) inform the caller by returning a boolean
const got_dtsg = function(fb_dtsg, technique, count) {
    count == count || 0;
    if (!FX.dtsg && fb_dtsg) {
        FX.dtsg = fb_dtsg;
        X.publish('fb_dtsg/ready', { fb_dtsg, technique, count, });
        return true;
    }
    return false;
};

// 1. <input name="fb_dtsg"> present on some pages

FX.dtsg || got_dtsg(X('[name=fb_dtsg]').attr('value'), '[name=fb_dtsg]');

FX.dtsg || setTimeout(function() {

// 2. embedded script code found on many pages (give it some time to load first)

    const DTSG_capture = '"([A-Z][-_a-z0-9A-Z]{11,65}:[\\d:]{11,19})"';
    const DTSG_REs = [
        { how: 'script:beacon', re: RegExp('eacon.{1,99}_user=.{1,150}' + DTSG_capture), },
        { how: 'script:initda', re: RegExp('DTSGInitData",\\[],{}?(?:"token":|)' + DTSG_capture), },
        { how: 'script:initia', re: RegExp('DTSGInitialData",\\[],{}?(?:"token":|)' + DTSG_capture), },
    ];
    Array.from(X('script')).find(script =>
        /dtsg/i.test(script.textContent) && DTSG_REs.some(RE =>
            (script.textContent.match(RE.re) && got_dtsg(RegExp.$1, RE.how))));

// 3. Call FB internal API
// window.requireLazy() must be called in the root window
// scope; we also have to wait until that function exists!

    FX.dtsg ||
        (X.subscribe('fb_dtsg/eject', (msg, data) => got_dtsg(data.fb_dtsg, data.technique, data.count)),
         X.inject(function() {
            const got_dtsg_inj = function(fb_dtsg, technique, count) {
                count == count || 0;
                if (fb_dtsg) {
                    // cross-scope X.publish('fb_dtsg/eject', { fb_dtsg, technique, count, });
                    window.postMessage({
                        sfx: true,
                        pagecontext: true,
                        message: { event: 'fb_dtsg/eject', data: { fb_dtsg, technique, count, }, },
                    }, '*');
                    return true;
                }
                return false;
            };
            var got_it = false;
            var called_fb = false;
            // Allow us to cancel after FB monkey-patch in their timer implementation
            const clearInterval = window.clearInterval;
            var cycle_count = 1;
            const gather_dtsg = function() {
                if (!called_fb && window.requireLazy) {
                    called_fb = true;
                    window.requireLazy(['invariant','DTSGInitialData','DTSG'], function(x, y, DTSG_module) {
                        if (DTSG_module && DTSG_module.getToken && x != y) {
                            got_it = got_dtsg_inj(DTSG_module.getToken(), 'requireLazy()', cycle_count);
                        }
                    });
                }
                if (got_it || ++cycle_count > 20) {
                    clearInterval(gather_dtsg.interval);
                    if (!got_it) {
                        got_dtsg_inj('failed', 'All techniques');
                    }
                }
            };
            gather_dtsg.interval = setInterval(gather_dtsg, 0.5 * 1000);
        }));
}, 100);

// ========================================================
// Global font size / family options & SFx UI scale
// ========================================================

// sfx_ui_scale must have a value even if this module never initializes
// (i.e. SFx self-disabled)
X.css('html { --sfx_ui_scale:1.2; }', 'sfx_body_font_css');

X.ready( 'font_family', function() {
    FX.add_option('font_family', {
        "section": "General"
        , "title": "Font: Custom Font"
        , "description": "Set a custom font name using CSS syntax to override the default Facebook fonts. You may add multiple fonts, separated by comma."
        , "type": "text"
        , "default": ""
    });
    FX.add_option('font_mult', {
        "section": "General"
        , "title": "Font: Custom Size"
        , "description": "Set a custom text size multiplier from 0.5 to 2.5 (default 1.0)."
        , "type": "text"
        , "default": ""
    });
    FX.add_option('font_ui_mult', {
        "section": "General"
        , "title": "Font: Social Fixer Size"
        , "description": "Set a custom font size multiplier for Social Fixer interface, from 0.5 to 2.5 (default 1.0)."
        , "type": "text"
        , "default": ""
    });
    const body_font_set_css = function () {
        const bound = (val, min, max, def) => (isNaN(val) || val < min || val > max) ? def : val;
        const toRational = (num, places) => (Number(num) || 0).toFixed(places || 4).replace(/(.)\.?0*$/,'$1');
        const font = FX.option('font_family');
        const size = bound(Number(FX.option('font_mult')), 0.5, 2.5, 1.0);
        const ui_size = bound(Number(FX.option('font_ui_mult')), 0.5, 2.5, 1.0);
        const css = [];
        if (font) {
            css.push(`body, body *, #facebook body, #facebook body._-kb { font-family:${font} !important; }`);
        }
        if (size != 1.0) {
            // Disable our own CSS so we can read the base size we are trying to scale
            X.css('', 'sfx_body_font_css');
            const baseSize = (getComputedStyle(document.documentElement)['font-size'] || '16px').replace(/px/, '');
            css.push(`html { font-size:${toRational(size * baseSize)}px; }`);
        }
        // Multiplied by 1.2 because the initial sizes chosen for SFx
        // elements when the global font size option was added were too
        // small relative to FB native scale.
        css.push(`html { --sfx_ui_scale:${toRational(ui_size * 1.2)}; }`);
        X.css(css.join('\n'), 'sfx_body_font_css');
    };
    FX.on_option_live(['font_family', 'font_mult', 'font_ui_mult'], body_font_set_css);
});

X.ready('friend_manager', function() {
    FX.add_option('friend_tracker', {"title": 'Friend Manager', "description": "Enable Friend Manager (Friends List Tracker)", "default": true});

    FX.add_option('friend_tracker_alert_unfriend', {"hidden":true, "default": true});
    FX.add_option('friend_tracker_alert_unfriend_count', {"hidden":true, "default": 3});
    FX.add_option('friend_tracker_alert_refriend', {"hidden":true, "default": true});
    FX.add_option('friend_tracker_alert_name_change', {"hidden":true, "default": true});
    FX.add_option('friend_tracker_update_frequency', {"hidden":true, "default": 1 });

    var log = X.logger('friend_manager');

    // Load the friends pref
    var fm_friends = X.clone(FX.storage('friends'));
    var fm_alerts = [];
    var custom_fields = FX.option('friend_custom_fields');

    X.subscribe("friends/options", function(msg,d) {
        // Render the friends dialog content
        var sections = [
            {"key":"alerts", "name":"Alerts"}
            ,{"key":"options", "name":"Options"}
            ,{"key":"list", "name":"Friends List"}
            ,{"key":"details", "name":"Friend Details"}
            ,{"key":"data", "name":"Raw Data"}
        ];
        var dialog = FX.oneLineLtrim(`<div id="sfx_friend_dialog" class="sfx_dialog sfx-flex-column" style="transition: height .01s;">
	<div id="sfx_options_dialog_header" class="sfx_dialog_title_bar" style="cursor:move;" @click="collapse" v-tooltip="{content:'Click to window-shade, drag to move',position:'below'}">
		Friend Manager - Social Fixer ${SFX.version}
		<div id="sfx_options_dialog_actions" draggable="false" >
			<input draggable="false" type="button" class="sfx_button secondary" @click.stop="close" value="Close">
		</div>
	</div>
	<div id="sfx_options_dialog_body" class="sfx-flex-row" draggable="false">
		<div id="sfx_options_dialog_sections">
			<div v-for="section in sections" @click="select_section(section.key)" class="sfx_options_dialog_section {{selected_section==section.key?'selected':''}}">{{section.name}}</div>
		</div>
		<div id="sfx_options_dialog_content">
			<div class="sfx_options_dialog_content_section">
				<div v-show="selected_section=='options'" style="line-height:32px;">
					<div><sfx-checkbox key="friend_tracker_alert_unfriend"></sfx-checkbox> Track and alert when someone is not present on my Facebook Friends List</div>
					<div>Alert about absent friends after this many absences: <input class="sfx_input" type="number" min="1" max="99" v-model="uf_count" @change="update_uf_count()"/></div>
					<div><sfx-checkbox key="friend_tracker_alert_refriend"></sfx-checkbox> Track and alert when someone reappears on my Facebook Friends List</div>
					<div><sfx-checkbox key="friend_tracker_alert_name_change"></sfx-checkbox> Track and alert when a friend changes their name</div>
					<div>Check for Friends List changes after this many hours: <input class="sfx_input" type="number" min="1" max="999" v-model="frequency" @change="update_frequency()"/></div>
					<div>Update my Friends List and check for changes immediately: <input type="button" @click="check_now()" class="sfx_button" value="Check Now"></div>
				</div>
				<div v-show="selected_section=='alerts'" id="sfx_friend_alerts"></div>
				<div v-show="selected_section=='list'">
					<div v-if="!list_loaded">Loading...</div>
					<div v-if="list_loaded">
						<div style="margin-bottom:3px;">
                            <b>Filter: </b><input class="sfx_input" type="text" v-model="filter">
                            <br>
                            <span v-if="limit < 9999 && nfriends > nlimit">
                                <b>Page: </b>
                                <a @click.prevent="set_page(-1)" class="sfx_link">&lt;&lt;</a>
                                &nbsp;{{page+1}} of {{Math.trunc((nfriends + nlimit - 1) / nlimit)}}&nbsp;
                                <a @click.prevent="set_page(1)" class="sfx_link">&gt;&gt;</a>
                            </span>
                            <span v-else>
                                Showing all {{nfriends}} friends.
                            </span>
                            <b>&nbsp; Friends per page: </b>
                            &middot;&nbsp;
                            <template v-for="value in ['10','50','100','250','500','1000','all']">
                                <a @click.prevent="set_limit(value)" class="sfx_link" v-bind:class="{'sfx_button':(value==limit)}">{{value}}</a> &middot;&nbsp;
                            </template>
                        </div>
						<table class="sfx_data_table">
							<thead>
								<tr>
									<th>&nbsp;</th>
									<th class="sortable" @click="order('name')">Name</th>
									<th class="sortable" @click="order('first')">First</th>
									<th class="sortable" @click="order('last')">Last</th>
									<th class="sortable" @click="order('id')">ID</th>
									<th class="sortable" @click="order('tracker.status')">Status</th>
									<th v-for="field in custom_fields">{{field}}</th>
									<th class="sortable" @click="order('tracker.added_on')">Added</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="f in fm_friends | filterBy filter | orderBy orderkey sortorder | limitBy nlimit (page*nlimit)">
									<td @click="select_user(f.id)"><img src="{{f.photo}}" style="height:48px;width:48px;"></td>
									<td class="sfx_hover_link" style="font-weight:bold;" @click="select_user(f.id)">{{f.name}}</td>
									<td>{{f.first}}</td>
									<td>{{f.last}}</td>
									<td><a href="https://www.facebook.com/{{f.id}}">{{f.id}}</a></td>
									<td>{{f.tracker.status}}</td>
									<td v-for="field in custom_fields">{{f.data[field]}}</td>
									<td>{{f.tracker.added_on | date}}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
				<div v-show="selected_section=='details'">
					<div v-if="!selected_user">
						Click on a friend in the "List" section.
					</div>
					<div v-else>
						<a href="https://www.facebook.com/{{selected_user.id}}"><img src="{{selected_user.photo}}" style="float:left;margin-right:20px;"><span style="font-size:calc(0.72rem * var(--sfx_ui_scale));font-weight:bold;">{{selected_user.name}}</span></a>
						<br style="clear:both;">

						This section will be used for future functionality that will enhance your Friends List even more!

						<!--
						<b>Custom Fields</b> : Fields below are created by you and maintained in the Options tab. You can define any fields, and any value in those fields per user.
						<div v-for="field in custom_fields" style="margin:10px;border:1px solid #ccc;padding:10px;">
							<b>{{field}}</b>: <input v-model="selected_user.data[field]">
						</div>
						-->
					</div>
				</div>
				<div v-show="selected_section=='data'" style="white-space:pre;font-family:monospace;">{{fm_friends | json}}</div>
			</div>
		</div>
	</div>
</div>
`);
        var data = {
            "sections": sections
            ,"selected_section":"alerts"
            ,fm_friends
            ,nfriends: Object.keys(fm_friends).length
            ,"list_loaded":false
            ,"orderkey":"name"
            ,"sortorder":1
            ,"filter":""
            ,"selected_user":null
            ,"custom_fields":X.clone(custom_fields)
            ,"frequency":FX.option("friend_tracker_update_frequency")
            ,"uf_count":FX.option("friend_tracker_alert_unfriend_count")
            ,"limit":50
            ,"nlimit":50
            ,"page":0
        };
        if (d&&d.selected) {
            data.selected_section=d.selected;
        }
        // Count friends

        var actions = {
            "select_section": function (key) {
                this.selected_section = key;
                var self = this;
                if (key == "list") {
                    // Lazy load the list for better performance
                    setTimeout(function() {
                        Vue.nextTick(function () {
                            self.list_loaded = true;
                        });
                    }, 100);
                }
            },
            "select_user": function(id) {
                this.selected_user = fm_friends[id];
                this.select_section('details');
            },
            "order": function(key) {
                this.sortorder = (this.orderkey == key) ? -1 * this.sortorder : 1;
                this.orderkey = key;
            },
            "close": function() {
                X('#sfx_friend_dialog').remove();
            },
            "check_now": function() {
                X.publish("friends/update");
            },
            "update_frequency": function () {
                FX.option('friend_tracker_update_frequency', data.frequency, true);
            },
            "update_uf_count": function () {
                FX.option('friend_tracker_alert_unfriend_count', data.uf_count, true);
            },
            "set_limit": function(l) {
                this.limit = l;
                this.nlimit = l == 'all' ? 9999 : Number(l);
                this.page = 0;
            },
            "set_page": function(p) {
                this.page += p;
                if (this.page < 0) {
                    this.page = 0;
                }
            },
            "collapse": function () {
                X('#sfx_options_dialog_body').toggle();
            },
        };
        template(document.body, dialog, data, actions).ready(function () {
            X.draggable('#sfx_friend_dialog');
            Vue.nextTick(function() {
                find_alerts();
                render_alerts('just now', true, '#sfx_friend_alerts', 'sfx_friend_changes_fm');
                if (fm_alerts.length == 0) {
                    actions.select_section("list");
                }
            });
        });
    });

    var fb_dtsg;
    X.subscribe_backlog('fb_dtsg/ready', (msg, data) => {
        fb_dtsg = data.fb_dtsg;
        var fb_dtsg_status = 'succeeded';
        if (fb_dtsg === 'failed') {
            fb_dtsg_status = 'failed';
        }
        X.support_note('fb_dtsg', `${data.technique} ${fb_dtsg_status} after ${(performance.now() / X.seconds).toFixed(6)} seconds`);
    });

    const retrieve_friends = function(cb) {
        // This request now requires the anti-CSRF token
        if (!fb_dtsg) {
            log('retrieve_friends 0: no fb_dtsg');
            X.support_note('retrieve_friends:0', `fb_dtsg not found: [${fb_dtsg}]`);
            return cb(null);
        }
        var friends_url = FX.oneLineLtrim(`
            https://www.facebook.com/ajax/typeahead/first_degree.php
            ?viewer=${X.userid}
            &__user=${X.userid}
            &filter[0]=user
            &options[0]=friends_only
            &__a=1
            &lazy=0
            &t=${X.now()}
            &fb_dtsg=${fb_dtsg}
        `);
        X.ajax(friends_url, function(content) {
            // This uses the browser console to take advantage of its structure explorer
            // -- and encapsulate as [{ object }] so the structures start out collapsed.
            if (typeof content !== 'string') {
                console.log('retrieve_friends:1: unexpected content type:', typeof content, [{ content, }]);
                X.support_note('retrieve_friends:1', `unexpected content type '${typeof content}' (see browser console)`);
                return cb(null);
            }
            try {
                var json = JSON.parse(content.replace(/^[^{}]*/, ''));
                if (!json || !json.payload || !json.payload.entries) {
                    console.log('retrieve_friends:2: unexpected JSON content:', [{ content, json, }]);
                    X.support_note('retrieve_friends:2', 'unexpected JSON content (see browser console)');
                    return cb(null);
                }
                return cb(json.payload.entries);
            } catch(e) {
                console.log('retrieve_friends:3: JSON.parse failed:', [{ error: e, content, json, }]);
                X.support_note('retrieve_friends:3', `JSON.parse failed: ${e} (see browser console)`);
                return cb(null);
            }
        });
    };

    const update_friends = function(cb) {

        // Retrieve Friends List
        var now = X.now();
        var empties = 0;
        var changes = 0;
        retrieve_friends(function(list) {
            if (list == null) {
                return cb(null);
            }

            var f, uid, sfx_friend;
            // For each friend, create the default record if needed
            for (f of list) {
                uid = f.uid;
                if (!Number(uid)) {
                    X.support_note('update_friends:1', 'non-numeric UID in FB data');
                    continue;
                }
                sfx_friend = fm_friends[uid];
                if (typeof sfx_friend == "undefined" || typeof sfx_friend.tracker == "undefined") {
                    sfx_friend = {
                        "id":f.uid
                        ,"name":f.text
                        ,"first":f.firstname
                        ,"last":f.lastname
                        ,"photo":f.photo
                        ,"tracker": {
                            "added_on":now
                            ,"status":"friend"
                            ,"updated_on":now
                            ,"acknowledged_on":null
                        }
                    };
                    fm_friends[uid] = sfx_friend;
                }
                // check for updated photo and name
                if (f.text != sfx_friend.name) {
                    sfx_friend.old_name = sfx_friend.name;
                    sfx_friend.name = f.text;
                    sfx_friend.first = f.firstname;
                    sfx_friend.last = f.lastname;
                    sfx_friend.dirty = true;
                }
                if (sfx_friend.photo != f.photo) {
                    // Do not report these as 'changes' to the user: they
                    // are almost always just CDN cache path differences;
                    // we can't distinguish them from actual new avatars.
                    sfx_friend.photo_dirty = true;
                    sfx_friend.photo = f.photo;
                }
                sfx_friend.checked_on = now;
                sfx_friend.tracker.missing_count = 0;
            }

            // Loop over friends to check for changes
            for (uid in fm_friends) {
                // Handle strange records due to some past bug
                if (!Number(uid)) {
                    X.support_note('update_friends:2', 'non-numeric UID in FT data');
                    delete fm_friends[uid];
                    X.storage.set("friends", uid, undefined, null, false);
                    continue;
                }

                f = fm_friends[uid];

                // Handle empty records due to some past bug
                if (!f.id || !f.tracker) {
                    ++empties;
                    f.id = uid;
                    f.tracker = f.tracker || {
                        added_on: now,
                        status: 'record missing',
                        updated_on: now,
                        acknowledged_on: null,
                    };
                    f.dirty = true;
                }
                var tracker = f.tracker;

                // NEW Friend
                if (tracker.added_on == now) {
                    f.dirty = true;
                }

                // RE-FRIENDED
                else if (now == f.checked_on && tracker.status != "friend") {
                    tracker.status = "refriend";
                    tracker.updated_on = now;
                    tracker.acknowledged_on = null;
                    f.dirty = true;
                }

                // REMOVED Friend
                // (Not found in new list, but they existed in old list)
                else if (now !== f.checked_on && (tracker.status == "friend" || tracker.status == "refriend")) {
                    tracker.missing_count = (tracker.missing_count) ? tracker.missing_count + 1 : 1;
                    if (tracker.missing_count >= FX.option('friend_tracker_alert_unfriend_count')) {
                        tracker.status = "unfriended";
                        tracker.updated_on = now;
                        tracker.acknowledged_on = null;
                        tracker.blocked = null;
                    }
                    f.dirty = true;
                }

                // Update this friend record?
                if (f.dirty || f.photo_dirty) {
                    f.dirty && changes++;
                    delete f.dirty;
                    delete f.photo_dirty;
                    X.storage.set("friends", uid, f, null, false);
                }
            }

            // Persist the updated Friends List
            if (changes) {
                X.storage.save('friends');
            }
            if (typeof cb == 'function') {
                cb({total:Object.keys(fm_friends).length, changes});
            }
            X.support_note('update_friends:3', `fr:${Object.keys(fm_friends).length} ls:${list.length} ch:${changes} em:${empties}`);
        });
    };

    const find_alerts = function() {
        fm_alerts.splice(0);

        for (var i in fm_friends) {
            var f = X.clone(fm_friends[i]);
            if (!f || !f.tracker) {
                continue;
            }
            var t = f.tracker;
            var upd = t.updated_on;
            var ack = t.acknowledged_on;

            // Unfriend
            if (t.status == 'unfriended' && (!ack || ack < upd) && FX.option('friend_tracker_alert_unfriend'))  {
                fm_alerts.push({type: 'unfriend', friend: f});
                // TODO: distinguish between unfriended, blocked, account
                // closed, in jail, whatever?  We used to try, but it was
                // inaccurate; and it started to trigger anti-bot guards.
            }
            // Re-friend
            if (t.status == 'refriend' && FX.option('friend_tracker_alert_refriend')) {
                fm_alerts.push({type: 'refriend', friend: f});
            }
            // name change
            if (f.old_name && FX.option('friend_tracker_alert_name_change')) {
                fm_alerts.push({type: 'name_change', friend: f});
            }
        }
    };

    const update_jewel_count = function() {
        X.publish('notify/set', {
            target: `.${SFX.instance} [id=sfx_friend_jewel_count]`,
            parent_target: SFX.badge_sel,
            count: fm_alerts.length, });
    };

    const notify_if_alerts_exist = function() {
        find_alerts();
        update_jewel_count();
    };

    const render_alerts = function(ago, show_header, appendTo, id) {
        try {
            X(`[id=${id}]`).remove();
            const data = {
                fm_alerts,
                ago,
                show_header,
            };
            const ok_one = function(alert) {
                const f = fm_friends[alert.friend.id];
                // Resolve based on the type of the alert
                if (alert.type == 'unfriend') {
                    f.tracker.acknowledged_on = X.now();
                } else if (alert.type == 'refriend') {
                    f.tracker.status = 'friend';
                } else if (alert.type == 'name_change') {
                    // no UI for name history, yet
                    if (!f.old_names) {
                        f.old_names = [];
                    }
                    f.old_names.push(f.old_name);
                    delete f.old_name;
                }
                // Update, don't persist
                X.storage.set('friends', f.id, f, null, false);
            };
            const persist = function() {
                update_jewel_count();
                X.storage.save('friends');
            };
            const actions = {
                ok: function(alert) {
                    ok_one(alert);
                    data.fm_alerts.splice(data.fm_alerts.indexOf(alert), 1);
                    persist();
                },
                ok_all: function () {
                    for (const alert of data.fm_alerts) {
                        ok_one(alert);
                    }
                    data.fm_alerts.splice(0);
                    persist();
                },
                settings: function () {
                    X.publish('friends/options', {selected: 'options'});
                },
            };
            const friend_alerts_html = FX.oneLineLtrim(`<div id="${id}">
    <div style="max-height:300px;overflow:auto;border-bottom:1px solid rgb(221,223,226);">
	<div v-if="show_header" style="padding:8px 12px 6px 12px;border-bottom:1px solid rgb(221,223,226);">
		<div style="float:right">
			<a @click.prevent="settings">Settings</a>
			<span v-if="fm_alerts.length" role="presentation"> &middot; </span>
			<a v-if="fm_alerts.length" @click.prevent="ok_all" style="font-weight:bold;">Okay All</a>
		</div>
		<div><span style="font-size:calc(0.6rem * var(--sfx_ui_scale));font-weight:bold;">Friend Changes</span> <span style="font-size:calc(0.55rem * var(--sfx_ui_scale));font-style:italic;">(via Social Fixer, updated {{ago}})</span></div>
	</div>
	<div v-for="a in fm_alerts | orderBy 'friend.tracker.updated_on' -1" style="padding:6px 12px;border-bottom:1px solid rgb(221,223,226);">
		<div style="float:right;height:50px;vertical-align:middle;line-height:50px;">
			<span @click="ok(a)" class="sfx_button light">Okay</span>
		</div>
		<img src="{{a.friend.photo}}" style="height:48px;margin-right:10px;display:inline-block;">
		<div style="display:inline-block;height:50px;overflow:hidden;">
			<template v-if="a.type=='name_change'">
				{{a.friend.old_name}}<br>
				is now known as<br>
				<a href="/{{a.friend.id}}" style="font-weight:bold;">{{a.friend.name}}</a><br>
			</template>
			<template v-if="a.type=='unfriend'">
				<a href="/{{a.friend.id}}" style="font-weight:bold;">{{a.friend.name}}</a><br>
				no longer appears on your Facebook Friends List. <span v-show="a.friend.removed" style="color:red;text-decoration:underline;cursor:help;" v-tooltip="This account is not available. This person has either disabled or removed their account, blocked you, or this is a result of a Facebook glitch (which is not uncommon). If they are still your friend but their profile is temporarily unavailable, they will appear as re-friended when it returns.">Account Not Found!</span><br>
				<i>{{a.friend.tracker.updated_on | ago}}</i>
			</template>
			<template v-if="a.type=='refriend'">
				<a href="/{{a.friend.id}}" style="font-weight:bold;">{{a.friend.name}}</a><br>
				is now on your Facebook Friends List again! <br>
				<i>{{a.friend.tracker.updated_on | ago}}</i>
			</template>
		</div>
	</div>
	<div v-if="fm_alerts.length==0" style="line-height:50px;vertical-align:middle;color:rgb(117,117,117);background-color:rgb(246,247,249);text-align:center;">
		No changes
	</div>
    </div>
</div>
`);
            template(appendTo, friend_alerts_html, data, actions);
        } catch (e) {
            alert(e);
        }
    };

    FX.on_options_load(function() {
        if (FX.option('friend_tracker')) {
        // Add wrench menu item
            X.publish('menu/add', {section: 'options', item: {html: '<span><span class="count" id="sfx_friend_jewel_count"></span>Friend Manager</span>', message: 'friends/options'}});

            // Update Friends List and check for changes
            X.task('friend_update', FX.option('friend_tracker_update_frequency') * X.hours, function () {
                log("Time to check for Friends List changes");
                X.subscribe_backlog('fb_dtsg/ready', function () {
                    update_friends(notify_if_alerts_exist);
                });
            }, notify_if_alerts_exist);

            X.subscribe('friends/update', function () {
                update_friends(function (result) {
                    if (result===null) {
                        alert("Error retrieving or updating friends list");
                    } else {
                        notify_if_alerts_exist();
                        alert(`Update Complete.\n${result.total} friends and ${result.changes} changes.`);
                    }
                });
            });
        }
    });
});

// =========================================================
// Hide parts of the page
// =========================================================
X.ready( 'hide', function() {
// Add an Option to trigger the popup in case people don't find it in the wrench menu
    FX.add_option('hide_parts_of_page',
        {
            "section": "General",
            "title": 'Hide Things',
            "description": 'Under the Wrench menu you will find an item to "Hide/Show Parts of the Page". Use this to hide or show different parts of the page that Social Fixer knows how to process. You can also access this functionality using the button to the right.',
            "type": "action",
            "action_message": "options/close,hide/on",
            "action_text": "Hide Things"
        }
    );
    FX.add_option('hide_parts_of_page_custom',
        {
            "section": "Debug",
            "title": 'Custom Hideables',
            "description": 'Define a custom JSON structure to be used instead of the server-side JSON for hideables.',
            "type": "textarea",
            "default":""
        }
    );
    FX.add_option('hide_parts_custom_merge',
        {
            "section": "Debug",
            "title": 'Merge Custom & Standard Hideables',
            "description": "Use both the server-side and custom hideables JSON.",
            "default": true,
        }
    );

    FX.on_options_load(function () {
        var menu_item = {"html": 'Hide/Show Parts of the Page', "message": "hide/on", "tooltip": "Select which parts of the page you want to hide so they never show up."};
        X.publish("menu/add", {"section": "actions", "item": menu_item});

        var hiddens = FX.storage('hiddens');
        if (!X.isObject(hiddens) && !X.isArray(hiddens)) {
            hiddens = {};
        }

        var resolve = function (hideable) {
            var o = X(hideable.selector);
            return (o.length && hideable.parent) ? o.nearby(hideable.parent) : o;
        };

        //  Two ways to hide things:
        // (1) Pure CSS if the hideable has no parent, or
        // (2) by watching for DOM insertions
        const dehide_prefix = 'html:not(.sfx_hide_show_all) ';
        var hiddens_with_parents, parented_selectors;
        var set_css_rules = function () {
            var parentless_selectors = [];
            hiddens_with_parents = [];
            parented_selectors = [];
            for (var id in hiddens) {
                var hidden = hiddens[id];

                if (!hidden.parent) {
                    // (1)
                    // Make hider selectors 'foo,bar' work with dehide_prefix
                    hidden.selector.split(',').forEach(sel =>
                        sel.length && parentless_selectors.push(`${dehide_prefix}${sel} /* sfx_hider_${hidden.id} */`));
                } else {
                    // (2)
                    hiddens_with_parents.push(hidden);
                    parented_selectors.push(hidden.selector);
                }
            }
            if (parentless_selectors.length > 0) {
                X.css(`${parentless_selectors.join(',\n')} { display:none !important; }`, 'sfx_hideables');
            }
            parented_selectors = parented_selectors.join(',');
        };
        set_css_rules();
        // Watch for DOM insertions and check for things to hide
        FX.on_content(function (o) {
            if (X(parented_selectors, o).length) {
                hiddens_with_parents.forEach(function (hidden) {
                    X(hidden.selector, o).nearby(hidden.parent).addClass(`sfx_hide_hidden sfx_hider_${hidden.id}`);
                });
            }
        });
        // Finishing function.  hide/off is expensive, don't do it on every ESC!
        const hide_show_finish = function() {
            const $ui = X('#sfx_hide_show_ui');
            if ($ui.length) {
                X.publish('hide/off');
                X.publish('esc/prevent');
                $ui.remove();
            }
        };
        X.subscribe('esc/pressed', hide_show_finish);

        X.subscribe("hide/on", function () {
            // Display the bubble popup

            // Chars used (no HTML entities for these):
            // U+25E4 ◤ (none) BLACK UPPER LEFT TRIANGLE
            // U+25E5 ◥ (none) BLACK UPPER RIGHT TRIANGLE
            // U+25E3 ◣ (none) BLACK LOWER LEFT TRIANGLE
            // U+25E2 ◢ (none) BLACK LOWER RIGHT TRIANGLE
            // Chars not used (mismapped HTML entities; plus, solids look better):
            // U+25F8 ◸ &ultri; UPPER LEFT TRIANGLE
            // U+25F9 ◹ &urtri; UPPER RIGHT TRIANGLE
            // U+25FA ◺ &lltri; LOWER LEFT TRIANGLE
            // U+25FF ◿ (none)  LOWER RIGHT TRIANGLE
            // U+22BF ⊿ &lrtri; RIGHT TRIANGLE (entity mapped to wrong codepoint)

            var content = X(FX.oneLineLtrim(`
                    <div class="sfx_hide_bubble">
                        <span id="sfx_hide_bubble_TL" style="position:absolute; top:0; left:5px; font-size:calc(0.75rem * var(--sfx_ui_scale));" data-hover="hider-tooltip" data-hider-title="Move to top left" data-hider-delay="650">&#x25E4;</span>
                        <span id="sfx_hide_bubble_TR" style="position:absolute; top:0; right:5px; font-size:calc(0.75rem * var(--sfx_ui_scale));" data-hover="hider-tooltip" data-hider-title="Move to top right" data-hider-delay="650">&#x25E5;</span>
                        <span id="sfx_hide_bubble_BL" style="position:absolute; bottom:0; left:5px; font-size:calc(0.75rem * var(--sfx_ui_scale));" data-hover="hider-tooltip" data-hider-title="Move to bottom left" data-hider-delay="650">&#x25E3;</span>
                        <span id="sfx_hide_bubble_BR" style="position:absolute; bottom:0; right:5px; font-size:calc(0.75rem * var(--sfx_ui_scale));" data-hover="hider-tooltip" data-hider-title="Move to bottom right" data-hider-delay="650">&#x25E2;</span>
                        <div class="sfx_hide_bubble_instructions">Mouse over <span style="background-color:#CFC">green shaded</span> areas to see their names; click to hide them.  (Shaded area may be offset from the item it will hide.)</div>
                        <div class="sfx_hide_bubble_instructions">To unhide items, click <span class="mark_read_markit sfx_hide_checkmark">&nbsp;&nbsp;&nbsp;</span><b>Show Hidden Items</b>, then click <span style="background-color:#FCC">red shaded</span> areas.</div>
                        <div class="sfx_hide_bubble_instructions">We update Social Fixer with new hideable areas as Facebook changes. To report new items, post a screenshot (with <span class="mark_read_markit sfx_hide_checkmark">&nbsp;&nbsp;&nbsp;</span><b>Show Hidden Items)</b> onto the <a href="https://SocialFixer.com/support/" target="_blank">Support Group</a>. We need to see <b><i>where</i></b> on the page.</div>
                        <span><input type="button" class="sfx_button sfx_button_done" style="margin:4px" value="Done Hiding"></span>
                        <span style="float:right">
                            <label data-hover="hider-tooltip" data-hider-title="So you can unhide them" data-hider-delay="1000"><input type="checkbox" class="sfx_button sfx_button_show">Show Hidden Items</label>
                            <br><label data-hover="hider-tooltip" data-hider-title="Shrink this box" data-hider-delay="1000"><input type="checkbox" class="sfx_button sfx_button_inst">Hide Instructions</label>
                        </span>
                    </div>
                `));

            var popup = bubble_note(content, {position: 'top_right', style: 'min-height:0', title: 'Hide/Show Parts of the Page', id: 'sfx_hide_show_ui', no_esc: true});
            popup.find('.sfx_button_done').click(hide_show_finish);
            popup.find('.sfx_button_show').click(function (/* event */) {
                X('html').toggleClass('sfx_hide_show_all');
            });
            popup.find('.sfx_button_inst').click(function (/* event */) {
                popup.find('.sfx_hide_bubble_instructions,.sfx_bubble_note_title').toggle();
            });
            popup.find('#sfx_hide_bubble_TL').click(function (/* event */) {
                popup.css({'top': 0, 'bottom': 'auto', 'left': 0, 'right': 'auto'});
            });
            popup.find('#sfx_hide_bubble_TR').click(function (/* event */) {
                popup.css({'top': 0, 'bottom': 'auto', 'left': 'auto', 'right': 0});
            });
            popup.find('#sfx_hide_bubble_BL').click(function (/* event */) {
                popup.css({'top': 'auto', 'bottom': 0, 'left': 0, 'right': 'auto'});
            });
            popup.find('#sfx_hide_bubble_BR').click(function (/* event */) {
                popup.css({'top': 'auto', 'bottom': 0, 'left': 'auto', 'right': 0});
            });

            var hider_title = function (idx) {
                const hidden = !!hiddens[hideables[idx].id];
                return `Click to ${hidden ? 'Unhide' : 'Hide'}:\n\n'${X.sanitize(hideables[idx].name)}'`;
            };

            var show_hideables = function (hideables, warn_server) {
                if (warn_server) {
                    var json_url = 'https://matt-kruse.github.io/socialfixerdata/hideable.json';
                    popup.find('.sfx_bubble_note_title').append(FX.oneLineLtrim(`
                        <div style="color:red; outline: 2px solid red; margin: 2px; padding: 3px;">
                            Can't access Hide/Show data on:<br>
                            <a href="${json_url}">${json_url}</a><br>
                            Is it blocked by the browser, an extension, or your firewall?
                        </div>`));
                }
                if (!hideables || hideables.length == 0) {
                    return;
                }
                X('html').addClass('sfx_hide_show_all');
                hideables.forEach(function (hideable, hideable_idx) {
                    resolve(hideable).forEach(el => {
                        const $el = X(el);
                        // make it overflow:visible for measurement
                        $el.addClass('sfx_hide_show_overflow');
                        var rect = el.getBoundingClientRect();
                        $el.removeClass('sfx_hide_show_overflow');
                        var h = rect.height;
                        var w = rect.width;
                        if (!h || !w) {
                            hideable.hollow = true;
                            return;
                        }
                        hideable.filled = true;
                        h = Math.max(h, 20);
                        w = Math.max(w, 20);
                        var position = ($el.css('position') == 'absolute' && $el.parent().css('position') == 'relative') ? 'position:relative;' : '';
                        var tooltip = `data-hover="hider-tooltip" data-hider-title="${hider_title(hideable_idx)}"`;
                        if (h > 500) {
                            tooltip += ` data-tooltip-position="${(rect.left > 200) ? 'left' : 'right'}";`;
                        }
                        var classes = 'sfx_hide_frame' + (!hiddens[hideable.id] ? '' : ' sfx_hide_frame_hidden sfx_hide_hidden');
                        var font_size = Math.min(h, window.innerHeight) / 1.5;
                        var styles = `width:${w}px;height:${h}px;font-size:${font_size}px;line-height:${h}px;display:${$el.css('display')};${position}`;
                        var wrapper = X(`<span ${tooltip} class="${classes}" style="${styles}" sfx_hider_id="${hideable.id}">X</span>`);

                        wrapper.click(function (target) {
                            target.preventDefault();
                            target.stopPropagation();
                            var hiding = !hiddens[hideable.id];
                            resolve(hideable).toggleClass("sfx_hide_hidden", hiding);
                            if (hiding) {
                                hiddens[hideable.id] = hideable;
                            } else {
                                delete hiddens[hideable.id];
                            }
                            // Update tooltip & classes for all of this hider's wrappers
                            X(`[sfx_hider_id="${hideable.id}"]`)
                                .toggleClass("sfx_hide_frame_hidden sfx_hide_hidden", hiding)
                                .attr('data-hider-title', hider_title(hideable_idx));
                            set_css_rules();
                        });
                        $el.before(wrapper);
                    });
                });
                X('html').removeClass('sfx_hide_show_all');
                // Note any old-layout hiders which are still effective
                X.support_note('Hide/Show old layout hideables',
                               hideables.filter(oh => oh.filled && oh.id < 10000).map(oh => oh.id).join(', '));
                // Note any hiders which find only zero-size ('hollow') elements
                X.support_note('Hide/Show hollow hideables',
                               hideables.filter(hh => hh.hollow && !hh.filled).map(hh => hh.id).join(', '));
            };
            var hide_parts_of_page_custom = FX.option('hide_parts_of_page_custom');
            var hide_parts_custom_merge = FX.option('hide_parts_custom_merge');

            var hideables = [];
            if (hide_parts_of_page_custom) {
                try {
                    var json = JSON.parse(hide_parts_of_page_custom);
                    if (json && json.hideables && json.hideables.length) {
                        hideables = json.hideables;
                        if (!hide_parts_custom_merge) {
                            return show_hideables(hideables, false);
                        }
                    }
                } catch(e) {
                    alert("ERROR Parsing custom JSON: "+e.toString());
                }
            }
            // hideable.json contains 'hideables': name[0] = filename, name[1] = struct name
            /* subscriptions.js: */ /* global update_subscribed_items */
            update_subscribed_items(['hideable', 'hideables', 'hiddens'], hiddens, function (subscriptions) {
                var warn_server = true;
                (Object.values(subscriptions) || []).forEach(function (server_item) {
                    if (!X.isObject(server_item)) {
                        return;
                    }
                    warn_server = false;      // Got at least one record from the server
                    var already_have = false;
                    hideables.forEach(function (hideable_item) {
                        if (hideable_item.id == server_item.id) {
                            already_have = true;
                        }
                    });
                    if (!already_have) {
                        hideables.push(server_item);
                    }
                });
                SFX.pose({ hiddens, hideables, resolve_hideable: resolve, });
                show_hideables(hideables, warn_server);
            });
        });

        X.subscribe("hide/off", function () {
            X('html').removeClass('sfx_hide_show_all');
            X('.sfx_hide_frame').remove();
            // Persist hidden areas
            X.storage.save('hiddens', hiddens, function () {
                set_css_rules();
            });
        });

        // Update subscribed hiders in the background every so often
        X.task('update_hider_subscriptions', 4 * X.hours, function () {
            update_subscribed_items(['hideable', 'hideables', 'hiddens'], hiddens, function(_, dirty) {
                if (dirty) {
                    set_css_rules();
                }
            });
        });
    });
});

// ========================================================
// Provide a View Log option
// ========================================================
X.ready('logging', function () {
  var log = X.logger('logging',{"color":"#666"});
  var viewer = null;
  var entries = null;
  var index = 0;
  var filter = null;

  X.publish("menu/add", {"section":"other", "item":{'html': 'View Log', 'message': 'log/view'}});
  X.subscribe("log/view", function() {
    log("View Log Clicked in Menu");
    show();
  });
  X.subscribe("log/entry", function() {
    if (viewer) {
      populate_entries(true);
    }
  });
  FX.on_content_loaded(function() {
    if (/sfx_log_filter=([^&]+)/.test(location.href)) {
      // Sanitize
      var str = RegExp.$1.replace(/[^\w\d -.]/g,'');
      log("Log Viewer Filter set through url: "+str);
      apply_filter(str);
    }
    if (/sfx_log=true/.test(location.href)) {
      log("Log viewer launched via url");
      show();
    }
  });

  var show = function() {
    create_log_viewer();
    populate_entries(false);
    viewer.show();
  };
  var create_log_viewer = function() {
    if (viewer) { return; }
    viewer = X(FX.oneLineLtrim(`
      <div id="sfx_log_viewer">
        <div class="sfx_dialog_title_bar" style="margin:0;">
          <div class="sfx_log_button" id="sfx_log_close" title="Close">X</div>
          Social Fixer Console
        </div>
        <div id="sfx_log_controls">
          Filter: <input id="sfx_log_filter" value="${filter?filter.source:''}">
        </div>
        <div id="sfx_log_viewer_entries"></div>
      </div>
    `));
    X('body').append(viewer);
    entries = X('#sfx_log_viewer_entries');
    X("#sfx_log_close").click(function() {
      viewer.hide();
    });
    X("#sfx_log_filter").keyup(function(e) {
      apply_filter(X.target(e).value);
      populate_entries(false);
    });
  };
  var apply_filter = function(str) {
    str = (str||'').trim();
    if (str) {
      filter = new RegExp(str, "i");
    }
    else {
      filter = null;
    }
  };
  var populate_entries = function(incremental) {
    var logs = X.logs;
    var html = [];
    if (!incremental) {
      index = 0;
      entries.html('');
    }
    for (; index<logs.length; index++) {
      var entry = logs[index];
      if (!entry.html) {
        entry.html = render_log_entry(entry);
      }
      if (!filter || (filter.test(entry.module) || filter.test(entry.html))) {
        html.push(entry.html);
      }
    }
    entries.append(html.join(''));
  };
  var lz = function(d) { return d.toString().replace(/^(\d)$/,"0$1"); };
  var render_log_entry = function(data) {
    // The log property holds an array of things to log
    var html = data.log.join(",");
    var d = new Date(data.timestamp);
    var timestamp = `${d.getHours()}:${lz(d.getMinutes())}:${lz(d.getSeconds())} ${(data.uptime / X.seconds).toFixed(4)}`;
    var css = data.color ? `color:${data.color};` : '';
    return `<div class="sfx_log_entry" style="${css}">${timestamp} ${data.module?'['+data.module+']':''} ${html}</div>`;
  };

});

// Detect whether we are on a login page
X.beforeReady(function () {
    const login_selectors = [
        /* On 'new layout' FB as of 2022-03-31: */
        /*   - 4 of these 6 selectors appear on the plain login page */
        /*   - a different 4 appear on the inline login on a 404 page */
        /*   - 0 appear on logged-in pages */
            /* reg, 404 */ 'body[class*=LoggedOut]',
            /* ---, 404 */ 'form#login_form',
            /* reg, --- */ 'form[data-testid*=login][action*="/login/"]',
            /* reg, 404 */ 'input[name=login_source]',
            /* reg, --- */ 'button[name=login][data-testid*=login]',
            /* ---, 404 */ 'button[id*=login][data-testid*=login]',
    ].join(',');

    FX.isNonLoginPage = (X(login_selectors).length < 2);

    // For users who need to wait until definitely known
    X.publish('login_page/ready');
});

// =========================================================
// Add Post Action Icons, including Mark Read
// =========================================================
X.ready( 'mark_read', function() {
    FX.add_option('post_actions', {"title": 'Post Actions', "description": "Add actions to individual posts to Mark them as 'Read', etc.", "default": true});
    FX.add_option('show_mark_all_read', {"title": 'Mark All Read/Undo', "description": "Add a Mark All Read button and Undo button to the control panel to Mark all visible posts as 'Read' or undo Marking posts as 'Read'.", "default": false});
    FX.add_option('mark_all_read_next', {"section": "Advanced", "title": 'Mark All Read - Next', "description": "When Mark All Read is clicked and filter tabs are visible, automatically jump to the next tab with unread stories.", "default": true});
    FX.add_option('clear_cache', {"title": 'Clear "Mark Read" Story Data', "section": "Advanced", "description": "Clear all cached data about posts' 'Read' status. This will un-Mark all 'Read' posts!", "type": "action", "action_text": "Clear Data Now", "action_message": "cache/clear"});
    FX.add_option('clean_cache_frequency', {"title": '"Mark Read" Cache Cleaning Frequency', "section": "Advanced", "description": "Clean the cache of old story data every how many hours?", "type": "number", "default": 24});
    FX.add_option('clean_cache_age', {"title": '"Mark Read" Cache Cleaning Age', "section": "Advanced", "description": "When cleaning cached story data, clean post data that is this many days old.", "type": "number", "default": 28});
    FX.add_option('hide_mark_read_groups', {title: 'Mark Read', description: "Hide posts Marked as 'Read' when viewing Groups.", default: true});
    FX.add_option('hide_mark_read_pages', {title: 'Mark Read', description: "Hide posts Marked as 'Read' when viewing a Page or Timeline.", default: true});
    FX.add_option('mark_read_display_message', {title: 'Mark Read', description: "Show a note in place of posts hidden because they were Marked as 'Read'.", default: true});
    FX.add_option('mark_read_style', {section: 'Advanced', title: 'Mark Read Style', description: "CSS style to be applied to posts that are Marked as 'Read'.", type: 'text', default: 'outline:2px dashed red;', live: style => X.css(`.sfx_post_read > :not(.sfx_read_note) { ${style} }`, 'sfx_mark_read_css')});

    (function () {
        var postdata_log = {}; // Keyed by DOM id!
        SFX.pose({ postdata_log, });
        var postdata_reset_time = performance.now();
        const x_log = X.logger('postdata');
        const postdata_trace = function (id, message) {
            const t1 = performance.now();
            var t0 = postdata_log[id] ? postdata_log[id][0] : t1;
            if (!postdata_log[id] || t0 < postdata_reset_time) {
                t0 = t1;
                postdata_log[id] = [t0];
                postdata_trace(id, `Post log starts at page time ${(t0 / X.seconds).toFixed(6)}`);
            }
            postdata_log[id].push(((t1 - t0) / X.seconds).toFixed(6) + ' ' + message);
        };
        X.subscribe("log/postdata", function (msg, data) {
            const id = data.id || (data.$post ? `sfx_post_${data.$post.attr('sfx_post')}` : null);
            if (id) {
                postdata_trace(id, data.message);
            } else {
                x_log(`log from unknown post: '${data.message}'`);
            }
        });
        X.subscribe("log/postdata/get", function (msg, data) {
            if (typeof data.callback != "function") {
                return;
            }
            data.callback(postdata_log[data.id]);
        });
        X.subscribe_backlog('posts/reset', () => (postdata_reset_time = performance.now()));
    })();

    // Clear Cache
    X.subscribe("cache/clear", function (/* msg, data */) {
        X.storage.save("postdata", {}, function () {
            alert("Social Fixer: the list of 'Read' posts has been cleared");
        });
    });
    FX.on_options_load(function () {
        if (!FX.option('post_actions')) {
            return;
        }

        // Add an option to the wrench menu to toggle stories marked as read
        const menu_item = {html: "Show posts Marked as 'Read'", message: 'post/toggle_read_posts', tooltip: "Make posts which are Marked as 'Read' temporarily visible."};
        X.publish("menu/add", {"section": "actions", "item": menu_item});

        var show_read = false;
        X.subscribe("post/toggle_read_posts", function () {
            show_read = !show_read;
            menu_item.html = show_read ? "Hide posts Marked as 'Read'" : "Show posts Marked as 'Read'";
            X('.sfx_show_read').removeClass('sfx_show_read');
            if (!FX.option('mark_read_display_message')) {
                X('.sfx_read_note').remove();
            }
            X('html').toggleClass('sfx_hide_read', !show_read);
            FX.reflow();
        });
        X.subscribe_backlog('posts/reset', () => X('html').addClass('sfx_hide_read'));

        // Logic to handle post actions
        var postdata = FX.storage('postdata') || {};
        SFX.pose({ postdata, });

        // post_id must be a non-zero integer (trailing ':digits' stripped elsewhere)
        var legit_post_id = (post_id) => /^-?[1-9][0-9]*$|^pfbid0[1-9A-HJ-NP-Za-km-z]{20,75}l$/.test(post_id);

        // read_on is a date stamp: must be just digits
        // (could also check for plausible time range?)
        var legit_read_on = (read_on) => /^[0-9]+$/.test(read_on);

        // On a regular interval, clean out the postdata cache of old post data
        // Also do other data cleansing tasks here
        X.task('clean_postdata_cache', FX.option('clean_cache_frequency') * X.hours, function () {
            var post_id, cleaned_count = 0;
            if (!postdata) {
                return;
            }
            for (post_id in postdata) {
                var data = postdata[post_id];
                var read_on = data.read_on;
                var age = X.now() - read_on;
                var clean_me = 0;
                // Purge old items
                if (age > FX.option('clean_cache_age') * X.days) {
                    clean_me = 1;
                }
                if (!legit_post_id(post_id)) {
                    clean_me = 1;
                }
                if (!legit_read_on(data.read_on)) {
                    clean_me = 1;
                }
                // Left over from 742eb642d241b4521a79139a5146dc3205a3c83b
                if (data.last_updated) {
                    delete postdata[post_id].last_updated;
                    cleaned_count++;
                }
                if (clean_me) {
                    delete postdata[post_id];
                    cleaned_count++;
                }
            }
            // Save the postdata back to storage
            if (cleaned_count > 0) {
                X.storage.save("postdata", postdata);
            }
        });

        var init_postdata = function (id) {
            if (typeof postdata[id] == "undefined") {
                postdata[id] = {};
            }
            return postdata[id];
        };

        var mark_all_added = false;

        FX.on_content_loaded(function () {
            var action_data = {
                id: null,
                sfx_id: 'no-ID',
                $post: null,
                show: 'mark',
                filters_enabled: FX.option('filters_enabled'),
                wrench_items: [],
                filter_items: []
            };
            var actions = {
                "mark_unmark": function (e) {
                    var data = {"sfx_id": action_data.sfx_id};
                    data.dir = e.shiftKey ? "above"
                             : e.ctrlKey || e.altKey || e.metaKey ? "below"
                             : "post";
                    X.publish("post/mark_unmark", data);
                }
                , "action_menu_click": function (item) {
                    var key, data = {"id": action_data.id, "sfx_id": action_data.sfx_id};
                    if (item.data) {
                        for (key in item.data) {
                            data[key] = item.data[key];
                        }
                    }
                    X.publish(item.message, data);
                }
            };
            var html = FX.oneLineLtrim(`
            <div id="sfx_post_action_tray_container" class="${SFX.instance}" sfx_pai="pai_counter">
                <div id="sfx_post_action_tray">
                    <div v-if="show == 'mark'"   @click="mark_unmark($event)" class="mark_read_markit" v-tooltip="Social Fixer: Mark this post as 'Read', so it doesn't appear in your feed anymore. Shift+Click Marks as 'Read' all posts above here; ${SFX.Ctrl}+Click Marks here and below"></div>
                    <div v-if="show == 'temp'"   @click="mark_unmark($event)" class="mark_read_nomark" v-tooltip="Social Fixer: Temporarily hide this post (it may return on reload, as its Facebook post ID was not found)"></div>
                    <div v-if="show == 'unmark'" @click="mark_unmark($event)" class="mark_read_unmark" v-tooltip="Social Fixer: Un-Mark this post as 'Read', so it may show up in your feed again">X</div>
                    <div v-if="show == 'utmark'" @click="mark_unmark($event)" class="mark_read_unmark" v-tooltip="Social Fixer: Unhide this temporarily hidden post">X</div>
                    <div v-if="wrench_items.length>0" id="sfx_mark_read_wrench" class="mark_read_wrench" v-tooltip="Social Fixer: Post Actions"></div>
                    <div v-if="filter_items.length>0" id="sfx_mark_read_filter" class="mark_read_filter" v-tooltip="Social Fixer: Filtering"></div>
                </div>
                <div v-if="wrench_items.length>0" id="sfx_post_wrench_menu" class="sfx_post_action_menu">
                    <div v-for="item in wrench_items | orderBy 'order'" @click="action_menu_click(item)">{{item.label}}</div>
                </div>
                <div v-if="filter_items.length>0" id="sfx_post_filter_menu" class="sfx_post_action_menu">
                    <div v-for="item in filter_items | orderBy 'order'" @click="action_menu_click(item)">{{item.label}}</div>
                </div>
            </div>
            `);

            var undo = {
                posts_marked_read: []
            };
            // Make the post not visible, and increment tab 'Read' counts
            var hide_read_one = function ($post, actor) {
                if (!$post.hasClass('sfx_post_read')) {
                    if ((FX.context.type == 'groups' && !FX.option('hide_mark_read_groups')) ||
                        (FX.context.type == 'profile' && !FX.option('hide_mark_read_pages'))) {
                        return;
                    }
                    const messages = FX.option('mark_read_display_message');
                    const forced = !messages && $post.is('.sfx_once');
                    if (messages || forced) {
                        const author = SFX.filter_extract_field.author($post, {}) || '<unknown>';
                        var tooltip = '';
                        if (!FX.option('disable_tooltips')) {
                            const aside = forced
                                ? "It is visible here because this page's address mentions it"
                                : 'To remove these Read-post notes, see Options > General > Mark Read';
                            tooltip = ` title="This post may be hidden because it is Marked as 'Read'. Click to toggle visibility. (${aside})"`;
                        }
                        const $note = X(FX.oneLineLtrim(`
                            <div class='sfx_read_note'${tooltip}>
                                <span class='sfx_read_show'>Click to view 'Read' post by ${author}</span>
                                <span class='sfx_read_hide'>Click to hide 'Read' post by ${author}</span>
                            </div>
                        `));
                        $note.click(function() {
                            $post.toggleClass('sfx_show_read');
                            if (forced) {
                                $note.remove();
                            }
                        });
                        $post.removeClass('sfx_once').prepend($note);
                    }
                    $post.addClass('sfx_post_read');
                    X.publish('post/hide_read', { id: $post[0].id, $post, actor, });
                }
            };
            var hide_read = function ($post, actor) {
                // Loop since FB's feed sometimes burps out multiple copies of the same post.
                // Can't loop for no-ID posts as they are unrelated.
                const sfx_id = $post.attr('sfx_id');
                if (legit_post_id(sfx_id)) {
                    $post.hasClass('sfx_post_read') || X(`[sfx_id="${$post.attr('sfx_id')}"]`).forEach(post => {
                        hide_read_one(X(post), actor);
                    });
                } else {
                    hide_read_one($post, actor);
                }
            };
            // Make the post visible, and decrement tab 'Read' counts
            var unhide_read_one = function ($post, actor) {
                if ($post.hasClass('sfx_post_read')) {
                    $post.removeClass('sfx_post_read sfx_show_read');
                    $post.find('.sfx_read_note').remove();
                    X.publish('post/unhide_read', { id: $post[0].id, $post, actor, });
                }
            };
            var unhide_read = function ($post, actor) {
                // Loop since FB's feed sometimes burps out multiple copies of the same post.
                // Can't loop for no-ID posts as they are unrelated.
                const sfx_id = $post.attr('sfx_id');
                if (legit_post_id(sfx_id)) {
                    $post.hasClass('sfx_post_read') && X(`[sfx_id="${$post.attr('sfx_id')}"]`).forEach(post => {
                        unhide_read_one(X(post), actor);
                    });
                } else {
                    unhide_read_one($post, actor);
                }
            };
            const actors = {
                post:  'user click',
                all:   'Mark All Read',
                above: 'Mark All Read Above (Shift+Click)',
                below: `Mark All Read Below (${SFX.Ctrl}+Click)`,
                undo:  'Undo',
            };
            // Receive change of post 'Read' status: save whether it is now 'Read',
            // control visibility, and adjust tab counts
            X.subscribe(['post/mark_read','post/mark_unread'], function (msg, data) {
                const marking = (msg == 'post/mark_read');
                const $post = data.post || action_data.$post;
                if (marking == $post.hasClass('sfx_post_read')) {
                    return;
                }
                const sfx_id = data.sfx_id;
                const legit = legit_post_id(sfx_id);

                if (!data.filter) {
                    undo.posts_marked_read = [$post];
                    undo.mark = !marking;
                }

                if (legit) {
                    var pdata = init_postdata(sfx_id);
                    if (marking) {
                        pdata.read_on = X.now();
                        postdata[sfx_id] = pdata;
                    } else {
                        delete pdata.read_on;
                    }
                    X.storage.set('postdata', sfx_id, pdata, null, false !== data.save);
                } else if (marking) {
                    X.publish('log/postdata', { $post, message: `Marking [${$post[0].id}] temporarily read`, });
                }
                if (actors[data.actor || 'post']) data.actor = actors[data.actor || 'post'];
                (marking ? hide_read : unhide_read)($post, data.actor);
                update_action_tray($post);
                FX.reflow();
            });
            // Receive change of multiple posts' 'Read' statuses (all user-click
            // actions): save new 'Read' status, adjust visibility & tab counts
            X.subscribe(["post/mark_all_read", "post/mark_unmark"], function (msg, data) {
                if (typeof data.dir == "undefined") {
                    data.dir = "all";
                }
                var $curr_post = data.post || action_data.$post;
                var mark = (data.dir == "all") || !$curr_post || !$curr_post.hasClass('sfx_post_read');
                data.actor = data.dir;
                if (data.dir == "post") {
                    const sfx_id = $curr_post.attr('sfx_id');
                    const legit = legit_post_id(sfx_id);
                    const is_read = (legit && postdata[sfx_id] && postdata[sfx_id].read_on) ||
                                    (!legit && $curr_post.hasClass('sfx_post_read'));
                    X.publish(is_read ? 'post/mark_unread' : 'post/mark_read', data);
                    return;
                }
                var marked = 0;
                var not_marked = 0;
                var marking = (data.dir == "all" || data.dir == "above");
                var unmark_one = false;
                var posts = [];
                var pivot_post = $curr_post ? +$curr_post.attr('sfx_post') : null;
                if ($curr_post && data.dir == "above") {
                    // Any existing selection gets extended by shift-click,
                    // then distorted by hiding & reflow; just abolish it:
                    window.getSelection().removeAllRanges();
                    // and get the post we were on back onscreen:
                    setTimeout(function () {
                        $curr_post[0].scrollIntoView();
                    }, 0.15 * X.seconds);
                }
                X(SFX.selected_tab_selector).each(function () {
                    var $post = X(this);
                    var this_post = +$post.attr('sfx_post');
                    if (this_post == pivot_post) {
                        if (data.dir == "above") {
                            // Mark Read Above excludes the current post
                            marking = false;
                            // Must be on a 'Read' post to invoke Unmark,
                            // so it *includes* current post
                            if (!mark) {
                                unmark_one = true;
                            }
                        }
                        else if (data.dir == "below") {
                            // Mark Read Below includes the current post
                            marking = true;
                        }
                    }
                    if (!marking && !unmark_one) {
                        not_marked++;
                        return;
                    }
                    unmark_one = false;
                    if (mark != $post.hasClass('sfx_post_read')) {
                        posts.push($post);
                        var pub_msg = mark ? "post/mark_read" : "post/mark_unread";
                        var pub_data = {
                            sfx_id: $post.attr('sfx_id'),
                            save: false, // Don't persist until the end
                            post: $post,
                            actor: data.actor,
                        };
                        X.publish(pub_msg, pub_data);
                        marked++;
                    }
                });
                if (marked > 0) {
                    X.storage.save("postdata");
                    undo.posts_marked_read = posts;
                    undo.mark = !mark;
                    if (data.dir == "above" && !show_read) {
                        X.publish('filter/tab/scroll_to_top');
                    }
                }
                if (mark && not_marked == 0 && FX.option('mark_all_read_next')) {
                    X.publish("filter/tab/next");
                }
            });
            X.subscribe("post/undo_mark_read", function (/* msg, data */) {
                if (undo.posts_marked_read.length > 0) {
                    var undo_msg = undo.mark ? "post/mark_read" : "post/mark_unread";
                    undo.posts_marked_read.forEach(function ($post) {
                        var sfx_id = $post.attr('sfx_id');
                        X.publish(undo_msg, { sfx_id, save: false, post: $post, actor: 'undo', });
                    });
                    X.storage.save("postdata");
                    undo.posts_marked_read = [];
                    FX.reflow();
                }
                else {
                    alert("Nothing to Undo!");
                }
            });

            const pai_submenus = [
                { name: 'filter', },
                { name: 'wrench', },
            ];
            const hide_pai_submenus =
                () => pai_submenus.forEach(
                    sm => sm.shown && X(`.${SFX.instance} [id=sfx_post_${sm.name}_menu]`).hide((sm.shown = false))
                );
            SFX.pai_counter = 0;
            const add_post_action_tray = function ($post) {
                var tray;
                if ((tray = $post.find(`[id=sfx_post_action_tray_container].${SFX.instance}`)).length) {
                    return tray;
                }
                template(document.body, html.replace(/pai_counter/, ++SFX.pai_counter), action_data, actions);
                X(`[id=sfx_post_action_tray_container].${SFX.instance}:not([sfx_pai="${SFX.pai_counter}"])`).remove();
                pai_submenus.forEach(function (sm) {
                    X(`#sfx_mark_read_${sm.name}`).click(function(ev) {
                        ev.stopPropagation();
                        hide_pai_submenus();
                        X(`.${SFX.instance} [id=sfx_post_${sm.name}_menu]`).css('right', 50 - ev.offsetX + 'px')
                                    .css('top', 5 + ev.offsetY + 'px')
                                    .show((sm.shown = true));
                    });
                });
                return X(`[id=sfx_post_action_tray_container].${SFX.instance}`);
            };
            X(window).click(hide_pai_submenus);

            var move_action_tray_to_post = function ($post) {
                action_data.$post = $post;
                action_data.id = $post[0].id;
                const sfx_id = $post.attr('sfx_id');
                action_data.sfx_id = sfx_id;
                const legit = legit_post_id(sfx_id);
                const is_read = (legit && postdata[sfx_id] && postdata[sfx_id].read_on) ||
                                (!legit && $post.hasClass('sfx_post_read'));
                action_data.show = is_read && legit ? 'unmark' : is_read ? 'utmark' : legit ? 'mark' : 'temp';
                const tray = add_post_action_tray($post);
                hide_pai_submenus();
                if (FX.context.type == 'marketplace') {
                    // Marketplace 'posts' are fairly different
                    $post.prepend(tray);
                } else {
                    // Appending to a regular post's top level sometimes ends up mis-placed;
                    // its child works better, but we must skip children which we added
                    // (like 'post is hidden') for proper PAI placement.
                    var $append_to = $post.children().filter(function() {
                        return !SFX.is_sfx_element(this);
                    });
                    if (!$append_to.length) {
                        $append_to = $post.children();
                    }
                    $append_to.first().append(tray);
                }
            };
            SFX.pose({ move_action_tray_to_post, });

            // Change action tray checkmark-vs-X & tooltip
            // when the state of the post it's on changes;
            // or if it's the first post to wear the tray.
            var update_action_tray = function ($post) {
                if (action_data.id == null || action_data.id == $post[0].id) {
                    move_action_tray_to_post($post);
                }
            };

            var page_permalinks = [];
            var page_permalinks_only = false;
            const permalink_regex = /(?:fbid|permalink|multi_permalinks|posts|video|stories|marketplace\/item|view=permalink.*&id)[=/]([\d,]{6,})/;
            const detect_permalinks = function() {
                const matches = decodeURIComponent(window.location.href).match(permalink_regex);
                page_permalinks = (matches ? matches[1] : '').split(',');
                page_permalinks_only = /\/pfbid0/.test(window.location.pathname);
                SFX.pose({ page_permalinks, permalink_regex, detect_permalinks, });
            };
            X.subscribe_backlog('posts/reset', detect_permalinks);

            // Tag and record permalink posts, log who did it, and inform FX.context of changes
            X.subscribe('post/permalink', function (msg, data) {
                if (!data.$post.hasClass('sfx_permalink_post')) {
                    data.$post.addClass('sfx_permalink_post');
                    X.publish('log/postdata', { id: data.id, $post: data.$post, message: `Marked as permalink by ${data.actor}` });
                    if (!page_permalinks.includes(data.sfx_id)) {
                        page_permalinks.push(data.sfx_id);
                    }
                }
                if (!FX.context.permalink) {
                    FX.context.permalink = true;
                    X.publish('context/changed');
                }
            });

            // As posts arrive, tag those which saved data indicates are 'Read',
            // adjust tab 'Read' counts, tag permalinks, and add PAI triggering
            X.subscribe_backlog('post/add', function (msg, data) {
                const $post = data.$post;
                const sfx_id = data.sfx_id;
                var classes = 'sfx_mr_checked';

                // Tag all permalink target posts
                if (page_permalinks_only || page_permalinks.includes(sfx_id)) {
                    X.publish('post/permalink', { $post, id: '', sfx_id, actor: 'mark_read', });
                }
                // If it's already read, hide it
                if (legit_post_id(sfx_id) && postdata[sfx_id] && postdata[sfx_id].read_on) {
                    const is_popup = $post.hasClass('sfx_popup_post');
                    X.publish('log/postdata', {$post, message: `Post ID=${sfx_id} was read on ${postdata[sfx_id].read_on}`});
                    // If it's the target of a permalink or in a popup, show it (with border / user styling)
                    if (is_popup || page_permalinks_only || page_permalinks.includes(sfx_id)) {
                        X.publish('log/postdata', { $post, message:
                            is_popup ? 'Post is in comment viewer popup'
                                     : 'Post named in permalink: make initially visible'
                        });
                        classes += ' sfx_once sfx_show_read';
                    }
                    hide_read($post, 'previous user action');
                }
                $post.addClass(classes);
                // Tray has the wrong checkmark if moused over before ID resolved
                update_action_tray($post);

                // When the mouse moves over the post, add the post action tray
                $post.on('mouseenter', function (e) {
                    // Don't add it if it's already present.
                    // Also allow user control: adding PAI can be slow with
                    // many posts loaded.
                    // Not Shift- or Ctrl- as those are mark-all-above/below
                    // and might well be pressed 'on descent into' a post's
                    // prospective PAI.
                    if (e.altKey || e.metaKey || e.sfx_event || action_data.$post[0] == $post[0]) {
                        return;
                    }
                    move_action_tray_to_post($post);
                });
            });

            // Add the "Mark All Read" button to the control panel if necessary
            const add_mark_all = function () {
                if (!mark_all_added && FX.option('show_mark_all_read')) {
                    X.publish('cp/always_show');
                    mark_all_added = true;
                    X.publish("cp/section/add", {
                        "name": "Post Controller"
                        , "order": 10
                        , "id": "sfx_cp_post_controller"
                        , "help": "Act on all visible posts at once"
                    });
                    // Wait until that has been rendered before attaching to it
                    Vue.nextTick(function () {
                        // The content container will have been created by now
                        if (!X.find(`.${SFX.instance} [id=sfx_cp_post_controller]`)) {
                            // Unless CP isn't being displayed at all...
                            mark_all_added = false;
                            return;
                        }
                        var html = FX.oneLineLtrim(`
                            <div class="sfx_cp_mark_all_read" style="text-align:center;">
                                <input type="button" class="sfx_button" value="Mark All Read" @click="mark_all_read">
                                <input type="button" class="sfx_button" v-bind:disabled="!undo.posts_marked_read" value="Undo ({{posts_marked_read.length}})" @click="undo_mark_read">
                            </div>`);
                        var methods = {
                            mark_all_read: () => X.publish('post/mark_all_read'),
                            undo_mark_read: () => X.publish('post/undo_mark_read'),
                        };
                        template(`.${SFX.instance} [id=sfx_cp_post_controller]`, html, undo, methods);
                    });
                }
            };
            X.subscribe_backlog('posts/reset', (() => ((mark_all_added = false), add_mark_all())));
            add_mark_all();

            X.subscribe_backlog('post/action/add', function (msg, data) {
                if (data.section == "wrench") {
                    action_data.wrench_items.push(data);
                }
                else if (data.section == "filter") {
                    action_data.filter_items.push(data);
                }
            });

            X.publish('post/action/add', {"section": "wrench", "label": "Post Data", order: 40, "message": "post/action/postdata"});
            X.subscribe('post/action/postdata', function (msg, data) {
                var log = [];
                X.publish("log/postdata/get", {
                    "id": data.id, "callback": function (pdata) {
                        log = pdata;
                    }
                });
                log = log.slice(1).map(str => X.htmlEncode(str)).join('<br>');
                const data_content = (legit_post_id(data.sfx_id) && postdata[data.sfx_id]) ?
                                     JSON.stringify(postdata[data.sfx_id], null, 3) : '{}';
                const content = FX.oneLineLtrim(`
                    <div>This popup shows what Social Fixer remembers about this post.</div>
                    <div class="sfx_bubble_note_data">Post ID: ${data.sfx_id}<br>DOM ID: ${data.id}</div>
                    <div>Data stored for this post:</div>
                    <div class="sfx_bubble_note_data">${data_content}</div>
                    <div>Processing Log:</div>
                    <div class="sfx_bubble_note_data">${log}</div>
                `);
                // Remove the previous one, if it exists
                X('[id=sfx_post_data_bubble]').remove();
                bubble_note(content, {"position": "top_right", "title": "Post Data", "id": "sfx_post_data_bubble", "close": true});
            });
        });
    });
});

FX.add_option('disabled', {"hidden": true, "default":false});

X.beforeReady(function(options) {
	// Prevent modules from running until we decide if SFX is disabled, which we can't do until options are loaded
	if (!options) { return false; }
	if (typeof sfx_menu_style !== 'undefined') {
		X.css(sfx_menu_style, 'sfx_menu_style');
	}
	// Check to see if SFX is disabled
	if (FX.option('disabled')) {
		// If we're disabled, we still need to add the wrench
		SFX.buildstr += ' (DISABLED)';
		init_wrench(true);
		X.when(SFX.badge_sel, $badge => $badge.attr('sfx_notification_count', 'X'));
		FX.fire_content_loaded();
		return false;
	}
	if (typeof sfx_style !== 'undefined') {
		X.css(sfx_style, 'sfx_style');
	}
});
X.ready( 'menu', function() {
	init_wrench(false);
});
var init_wrench = function(disabled) {
	FX.add_option('badge_x', {"hidden": true, "default": -64});
	FX.add_option('badge_y', {"hidden": true, "default": 5});
	FX.add_option('reset_wrench_position', {"title": '  Wrench Menu', "section": "Advanced", "description": "If your wrench menu badge somehow gets positioned so you can't see it, click here to reset its position to the upper right corner.", "type": "action", "action_text": "Find Wrench Menu", "action_message": "menu/reset_position"});
	FX.add_option('news_alerts', {"title": 'Social Fixer News', "section": "Advanced", "description": "Check for official news or blog posts from the Social Fixer team so you don't miss out on updates, updated filters, important news, etc. (Estimated frequency is one post a week)", "default": true});
	var actions = {
		"add": function (section, menu_item) {
			data.sections[section].items.push(menu_item);
		}
		,"remove": function(section, menu_item) {
			var items = data.sections[section].items;
			for( var i = 0; i < items.length; i++){
				var existing_item = items[i];
				if (menu_item.message===existing_item.message) {
					items.splice(i, 1);
					i--;
				}
			}
		}
		, "click": function (message) {
			if (message) {
				X.publish(message);
			}
		}
		, "toggle": function () {
			var $badge = X(SFX.badge_sel);
			var $menu = $badge.find('[id=sfx_badge_menu]');
			if ($menu.css('display') == 'none') {
				$menu.css('visibility', 'hidden');
				$menu.show();
				// Figure out which direction to pop the menu
				var window_width = document.body.clientWidth || window.innerWidth;
				var window_height = window.innerHeight;
				var left = $badge[0].offsetLeft;
				var top = $badge[0].offsetTop;

				if (left <= window_width / 2) {
					$menu.addClass('right').removeClass('left');
				}
				else {
					$menu.addClass('left').removeClass('right');
				}

				if (top <= window_height / 2) {
					$menu.addClass('down').removeClass('up');
				}
				else {
					$menu.addClass('up').removeClass('down');
				}
				$menu.css('visibility', '');
			}
			else {
				$menu.hide();
			}
		}
		, "hide": function () {
			let cur_menu = X(`${SFX.badge_sel} [id=sfx_badge_menu]`);
			if (cur_menu[0].style.display !== 'none') {
				X.publish('esc/prevent');
				cur_menu.hide();
			}
		}
	};
	const update_total_notify = function (count) {
		X.publish('notify/set', {
			target: `.${SFX.instance} [id=sfx_unread_blog_count]`,
			parent_target: SFX.badge_sel,
			count, });
	};
	var data = {
		"sections": {
			"options": {
				"title": "Options",
				"items": [],
				"order": 1
			},
			"actions": {
				"title": "Actions",
				"items": [],
				"order": 2
			},
			"links": {
				"title": "Links",
				"items": [],
				"order": 3
			},
			"debug": {
				"title": "Debug",
				"items": [],
				"order": 4
			},
			"other": {
				"title": "Other",
				"items": [],
				"order": 5
			}
		}
	};
	var html = FX.oneLineLtrim(`
		<div id="sfx_badge" class="${SFX.instance}" @click.stop="toggle" v-tooltip="{content:'Drag to move Social Fixer wrench menu badge - ${SFX.buildstr}',delay:1500}">
			<div id="sfx_badge_menu">
				<div id="sfx_badge_menu_wrap">
					<div v-for="section in sections | orderBy 'order'" class="sfx_menu_section" id="sfx_menu_section_{{$key}}">
						<div v-if="section.items.length" class="sfx_menu_section_title">{{section.title}}</div>
						<div v-for="item in section.items" id="{{item.id}}" class="sfx_menu_item" @click="click(item.message);" title="{{item.tooltip}}">
							<a v-if="item.url" href="{{item.url}}" target="{{item.target}}" class="sfx_menu_item_content" style="display:block;">{{{item.html}}}</a>
							<div v-else class="sfx_menu_item_content">{{{item.html}}}</div>
						</div>
					</div>
				</div>
			</div>
			<div id="sfx_badge_logo"></div>
		</div>
	`);

	var badge_greetings = function ($badge) {
		// If this is the first install, show the user where the badge is
		FX.on_options_load(function () {
			if (!FX.storage('stats').installed_on) {
				const position = (FX.option('badge_x') < 0) ? 'left' : 'right';
				const larr = position === 'right' ? '&larr; ' : '';
				const rarr = position === 'left'  ? ' &rarr;' : '';
				const note = sticky_note(SFX.badge_sel, position, larr + 'Social Fixer is installed! Start here' + rarr);
				X.storage.set('stats', 'installed_on', X.now());
				$badge[0].addEventListener('mouseover', () => note.remove(), { once: true });
			}
		});
	};

	var made_badge = false;

	var make_badge = function () {
		// Don't try if document body not yet created;
		// don't show on login page (or before we know whether it is one).
		// FUTURE: wrench might give menu noting that pre-login settings
		// apply only to the login page.  Users may wish to use Hide/Show
		// or Display Tweaks to improve the login page.  (In that event,
		// 'is installed!' banner should still defer until logged in.)
		if (!X.find('body') || !FX.isNonLoginPage) {
			return null;
		}

		// If the badge already exists for some reason, we have multiple SFx
		// instances running.  Despite the 'old' naming here, we don't know
		// which is 'newer' or 'better'.  Create our badge, leaving the other
		// one active.  Report it to the user (in sfx_collision.js), passing
		// version info between instances via their badge DOM attributes.
		var $old_badge = X('[id=sfx_badge]'), old_buildstr = null;
		if ($old_badge.length) {
			// other SFX's name (or older nameless, call it 'old')
			old_buildstr = $old_badge.attr('sfx_buildstr') || 'old';
		}

		// Attach the menu template to the DOM
		template("body", html, data, actions).ready(function () {
			position_badge('saved', null, false);
			X.draggable(SFX.badge_sel, function (el, x, y) {
				position_badge(x, y, true);
			});
		});
		var $new_badge = X(SFX.badge_sel);
		$new_badge.attr('sfx_buildstr', SFX.buildstr).attr('old_buildstr', old_buildstr);
		badge_greetings($new_badge);
		made_badge = true;
		return $new_badge;
	};

	/* eslint-disable no-mixed-spaces-and-tabs */
	// Try rapidly to make the badge appear as early as we can.
	var check_badge = function() {
		if (!made_badge &&			// Only make it once
		    check_badge.tries-- > 0) {		// Don't be a permanent burden
			if (FX.isNonLoginPage) {	// FX.isNonLoginPage is async
							// Never on the FB login page!
				make_badge('check_badge');
			}
			setTimeout(check_badge, check_badge.cadence * X.seconds);
		}
	};
	/* eslint-enable no-mixed-spaces-and-tabs */
	check_badge.cadence = 0.5;			// 2x a second
	check_badge.tries = 10 / check_badge.cadence;	// for max 10 seconds
	setTimeout(check_badge, check_badge.cadence * X.seconds);

	// This content_loaded call normally happens long after the
	// check_badge timer series has succeeded; it's just a suspender
	// to go with the belt.
	FX.on_content_loaded(() => made_badge || make_badge());

	const pb_log = X.logger('position_wrench');

	const position_badge = function (x, y, persist, is_retry = false) {
		if (!X('#sfx_style').length) {
			if (!is_retry) {
				pb_log('sfx_style     ', 'not ready: retry');
				return setTimeout(() => position_badge(x, y, persist, true), 0.2 * X.seconds);
			} else {
				pb_log('sfx_style     ', 'missing, giving up');
				X.support_note('position_badge', 'sfx_style was missing');
			}
		}
		var $badge = X(SFX.badge_sel);
		if (!$badge.length) {
			$badge = make_badge();
			if (!$badge) {
				pb_log('make_badge()  ', "didn't work");
				X.support_note('position_badge', "make_badge() didn't work");
				return;
			}
		}

		const window_width = document.body.clientWidth || window.innerWidth;
		const window_height = window.innerHeight;
		pb_log('document.body ', document.body.clientWidth, document.body.clientHeight);
		pb_log('window.inner  ', window.innerWidth, window.innerHeight);
		pb_log('window_size   ', window_width, window_height);

		if (x == 'saved') {
			// Re-position it with saved options
			x = FX.option('badge_x');
			y = FX.option('badge_y');
			pb_log('previous saved', x, y);
		}
		if (!Number.isInteger(x) || !Number.isInteger(y)) {
			x = FX.option_default('badge_x');
			y = FX.option_default('badge_y');
		}
		pb_log('integer check ', x, y);

		// Reconstitute from possible negative saved values
		x = (x < -window_width)  ? 0 : (x < 0) ? x + window_width  : x;
		y = (y < -window_height) ? 0 : (y < 0) ? y + window_height : y;
		pb_log('reconstituted ', x, y);

		// Make sure it's on the screen (+4px for badge notification indicator)
		const badge_size = $badge.offset();
		pb_log('badge_size    ', badge_size.width, badge_size.height);
		if (badge_size.width  < 5 || badge_size.width  > 100 ||
		    badge_size.height < 5 || badge_size.height > 100) {
			// width / height can be crazy before SFx CSS loads; if so,
			// force it to the default image's size (may still be wrong
			// if user is overriding it with CSS, but won't be way off)
			badge_size.width = badge_size.height = 34;
			pb_log('override size ', badge_size.width, badge_size.height);
		}
		x = Math.max(4, Math.min(x, window_width -  badge_size.width));
		y = Math.max(4, Math.min(y, window_height - badge_size.height));
		pb_log('kept on-screen', x, y);

		// Position it
		$badge.css({ left: x, top: y, });

		// Persist the badge location
		if (persist) {
			// If the position is on the right or bottom half of the window, store
			// it as a negative relative to the opposite edge.  This helps retain a
			// reasonable position if the window size is dragged larger or smaller.
			x = (x > window_width  / 2) ? x - window_width  : x;
			y = (y > window_height / 2) ? y - window_height : y;
			pb_log('values to save', x, y);
			FX.option('badge_x', x, false);
			FX.option('badge_y', y, false);
			X.storage.save("options");
		}
	};

	actions.add('links', {id: 'sfx_badge_menu_item_page', html: '<span id="sfx_unread_blog_count"></span>Social Fixer News/Blog', url: 'https://www.facebook.com/socialfixer', message: 'menu/news_clicked'});
	actions.add('links', {'html': 'Support Group', 'url': 'https://socialfixer.com/support/'});
	if (disabled) {
		actions.add('options', {'html': 'Social Fixer is <span style="color:red;font-weight:bold;">Disabled</span>.<br>Click here to Enable.</span>', 'message': 'menu/enable'});
		actions.add('other', {'html': 'Version ' + SFX.buildstr, 'message': 'menu/about_clicked'});
	}
	else {
		actions.add('options', {'html': 'Social Fixer Options <span style="font-size:calc(0.5rem * var(--sfx_ui_scale));color:#aaa;">(Ctrl+Shift+X)</span>', 'message': 'menu/options'});
		actions.add('links', {'html': 'Donate To Support Development', 'url': 'https://socialfixer.com/donate.html'});
		actions.add('other', {'html': 'Version ' + SFX.buildstr, 'message': 'menu/about_clicked'});
		actions.add('other', {'html': 'Disable Social Fixer', 'message': 'menu/disable'});
	}

	const open_disabled_menu = function() {
		// Reset badge position: menu we're opening must be visible
		X.publish('menu/reset_position');
		// Open menu (now at default position)
		return X.when(SFX.badge_sel, $badge => $badge.click());
	};

	// Keyboard shortcut to Options (enable-only menu when disabled)
	X(window).keyup(function(e) {
		// Opera & sometimes Firefox have Ctrl-Shift-X shortcuts,
		// so accept this without minding any extra modifiers.
		if (!e.ctrlKey || !e.shiftKey || (e.key != 'x' && e.key != 'X')) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		if (disabled) {
			return open_disabled_menu();
		}
		// Re-display wrench in user's position (it sometimes disappears)
		// then open Options.  If harder reset desired, do it in Options.
		position_badge('saved', null, false);
		X.publish("menu/options");
	});

	// Listen for enable/disable
	X.subscribe('menu/disable', function() {
		if (confirm("This will disable all Social Fixer functionality, but the wrench will still appear so you can re-enable.\n\nThe page will be automatically refreshed after disabling.\n\nAre you sure you want to disable?")) {
			X.storage.set('options','disabled',true,function() {
				window.location.reload();
			});
		}
	});
	X.subscribe('menu/enable', function() {
		X.storage.set('options','disabled',false,function() {
			window.location.reload();
		});
	});

	// Listen for messages to add items to the menu
	X.subscribe_backlog('menu/add', function (msg, data) {
		actions.add(data.section, data.item);
	});
	// Listen for messages to REMOVE items from the menu
	X.subscribe('menu/remove', function (msg, data) {
		actions.remove(data.section, data.item);
	});

	X(window).click(actions.hide);
	X.subscribe('esc/pressed', actions.hide);
	window.addEventListener('resize', function () {
		position_badge('saved', null, true);
	});

	X.subscribe("menu/reset_position", function (/* msg, data */) {
		var undef;
		X.storage.set('options', {'badge_x': undef, 'badge_y': undef}, function () {
			position_badge('saved', null, true);
		});
	});

	// About
	X.subscribe('menu/about_clicked', function () {
		X.publish("menu/options", {"section": "About"});
	});

	// If disabled, don't check for blog posts; do respond to Options URL
	if (disabled) {
		if (/sfx_options=true/.test(location.href)) {
			open_disabled_menu();
		}
		return;
	}

	// NEWS CHECK
	// Check for Posts to the Social Fixer Page and alert if there are new ones
	FX.on_options_load(function () {
		X.task('news_alerts', 1 * X.seconds, function () {
			if (FX.option('news_alerts')) {
				X.when(`.${SFX.instance} [id=sfx_badge_menu_item_page]`, function ($item) {
					var now = X.now();
					X.storage.get('stats', {}, function (stats) {
						// Don't show the current blog entry when first installed;
						// wait for the next one -- nobody wants to install a thing
						// and it immediately starts bleating about its blog alerts!
						if (!stats || !stats.sfx_news_checked_on) {
							X.storage.set("stats", "sfx_news_checked_on", now, function () {
							});
						}
						else {
							X.ajax("https://matt-kruse.github.io/socialfixerdata/news.json", function (json) {
								if (!json || !json.news) {
									return;
								}
								var count = 0, title = null, main_href = null;
								const $link = $item.find('a');
								json.news.reverse().forEach(function (news) {
									// Oldest processed last, so href
									// points to oldest not-seen entry.
									if (news.time > stats.sfx_news_checked_on) {
										main_href = $link.attr('href');
										$link.attr('href', news.href);
										title = news.title;
										count++;
									}
								});
								update_total_notify(count);

								if (count>0) {
									// Add a "clear notification" link
									var $clear = X(`<div style="text-align:right;font-size:calc(0.55rem * var(--sfx_ui_scale));color:#777;" class="sfx_link sfx_clear_notification_link">clear notification</div>`);
									$clear.click(function () {
										$link.attr('href', main_href);
										clear_news_notification();
									});
									$item.before($clear);
								}
								if (count == 1 && title) {
									$item.find('.sfx_menu_item_content').append('<div class="sfx_news_title">' + X.sanitize(title) + '</div>');
								}
							});
						}
					});
				});
			}
		});
	});
	var clear_news_notification = function() {
		X.storage.set("stats", "sfx_news_checked_on", X.now(), function () {
			update_total_notify(0);
			X('.sfx_news_title,.sfx_clear_notification_link').remove();
		});
	};
	X.subscribe('menu/news_clicked', function (/* msg, data */) {
		// Clear when clicked
		clear_news_notification();
	});
};

// =========================================================
// For Message links to open Messenger instead of a chat box
// =========================================================
X.ready('message_links_to_messenger', function() {
    FX.add_option('messages_open_in_full_window',
        {
            title: 'Open Messages In Full Tab',
            description: 'Open Facebook chat conversations in their own full browser tabs instead of chat boxes at the bottom.',
            default: false,
        }
    );

    var event_target = null;

    const redirect_message_link = function(event) {
        // Allow loopback links when already in Messenger
        if (/\/messages($|\/)/.test(window.location.href) ||
                    /(^|\.)messenger\.com$/.test(window.location.hostname)) {
            return;
        }
        // don't act on buttons which are nested inside a message link
        var href = X.target(event, true).closest('[role=button],[href*="/messages/t/"]').attr('href');
        if (href && !/#$/.test(href)) {
            window.open(href);
            event.stopPropagation();
            event.preventDefault();
        }
    };

    FX.on_option_live('messages_open_in_full_window', function (enabled) {
        event_target = X.uncapture(event_target, 'click', redirect_message_link);
        if (enabled) {
            event_target = X.capture(document.documentElement, 'click', redirect_message_link);
        }
    });
});

// =========================================================
// Force the main Newsfeed to the Most Recent view
// =========================================================
X.ready( 'most_recent', function() {
	FX.add_option('auto_switch_to_recent_stories', {"title": 'Automatically Switch to Most Recent view of the main Newsfeed', "description": "Facebook defaults to Top Posts. This option detects this view and automatically switches you to the chronological Most Recent view.", "default": false});
	FX.add_option('auto_switch_hide_message', {"section":"Advanced", "title": 'Hide Most Recent switch messages', "description": "When automatically switched to the Most Recent news feed, hide the message that appears to inform you of the switch.", "default": false});
	FX.add_option('redirect_home_links', {"section": "Advanced", "title": 'Redirect Home Links', "description": 'Try to keep links to the Home Page in your current view - Most Recent or Top Posts.', "default": true});
	FX.on_options_load(function () {
		if (FX.option('redirect_home_links')) {
			FX.on_content_loaded(function () {
				X.capture(document.body, 'mousedown', function (e) {
					// Button 0 only, with no modifiers!
					if (e.button || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
						return;
					}
					var $e = X.target(e, true);
					if (!$e.is('a')) {
						$e = $e.closest('a');
					}
					var href = $e.attr('href');
					if (href=="/" || /facebook\.com\/$/.test(href)) {
						// Don't force Most Recent link if clicking "Back to Top Posts" which only exists in the Main container
						// Force Top Posts instead
						if ($e.closest('*[role="main"]').length) {
							e.preventDefault();
							e.stopPropagation();
							location.href = "/?sk=h_nor";
						}
						// This is a link from somewhere to the News Feed, so make sure it's a Most Recent link
						else if (FX.option('auto_switch_to_recent_stories')) {
							e.preventDefault();
							e.stopPropagation();
							location.href = "/?sk=h_chr";
						}
					}
				});
			});
		}

		// Force Most Recent
		FX.on_content_loaded(function () {
			if (FX.option('auto_switch_to_recent_stories')) {
				if (/[?&]sfx_switch=true/.test(location.search)) {
					if (!FX.option('auto_switch_hide_message')) {
						const position = (FX.option('badge_x') < 0) ? 'left' : 'right';
						const note = sticky_note(SFX.badge_sel, position, 'Auto-switched to Most Recent');
						setTimeout(function () {
							note.remove();
						}, 3.0 * X.seconds);
					}
					return;
				}
				// Don't redirect URLs which ask for SFx options or any particular feed
				if (/[?&](?:sfx_options=true|sk=)/.test(location.search)) {
					return;
				}
				var redirect_now = function () {
					// Failsafe in case redirect doesn't cause reload
					setTimeout(function () {
						X(document.body).css('opacity', '1');
					}, 2.0 * X.seconds);
					X(document.body).css('opacity', '.2');
					location.href = "/?sk=h_chr&sfx_switch=true";
				};
				if (location.pathname=="/") {
					// The new layout always has sk=h_chr in Most Recent view
					// If we're on root Facebook, redirect
					redirect_now();
				}
			}
		});
	});
});

X.ready('notify', function() {
    X.subscribe('notify/set', (msg, data) =>
        X.when(data.target, function($target) {
            var old_count = $target.attr('sfx_notification_count') || 0;
            var new_count = +('count' in data ? data.count : old_count || 0) +
                            +('increment' in data ? data.increment : 0);
            $target.attr('sfx_notification_count', new_count);
            if (data.parent_target) {
                old_count == 0 && new_count  > 0 && X.publish('notify/increment', {target: data.parent_target});
                old_count  > 0 && new_count == 0 && X.publish('notify/decrement', {target: data.parent_target});
            }
        }, 200, 100) // nominally 20 seconds
    );

    X.subscribe(['notify/increment', 'notify/decrement', 'notify/clear'], function(msg, data) {
                    const parent_target = data.parent_target, target = data.target;
                    X.publish('notify/set',
                        msg === 'notify/increment' ? { parent_target, target, increment: 1 } :
                        msg === 'notify/decrement' ? { parent_target, target, increment: -1 } :
                        msg === 'notify/clear'     ? { parent_target, target, count: 0 } :
                        {}
                    );
                });
});

X.ready('options', function() {
	/* subscriptions.js: */ /* global update_subscribed_items */
	/* subscriptions.js: */ /* global mark_subscribed_items */
	/* subscriptions.js: */ /* global retrieve_item_subscriptions */
	FX.add_option('show_filtering_tooltips', {"hidden":true, "default": true});

SFX.filter_dbg_corrupted = false;
SFX.filter_dbg_corruption = function(msg, bad_filter) {
  if (!SFX.filter_dbg_corrupted) {
    SFX.filter_dbg_corrupted = true;
    msg = `Social Fixer: post-filters corrupted: ${msg}`;
    console.log('>>>>>', msg, { original: X.clone(SFX.filter_dbg_preserved_filters),
                                messedup: X.clone(X.storage.data.filters),
                                bad_filter: X.clone(bad_filter), });
    alert(`PROBLEM WITH FILTERS: ${msg}! PLEASE LEAVE TAB OPEN; CONTACT BELA via socialfixer.com/support; be prepared to show browser console from this tab`);
  }
};
SFX.filter_dbg_check_filters = function(msg) {
  if (!X.storage.data.filters.every(filter => X.isArray(filter.rules) && X.isArray(filter.actions)))
    SFX.filter_dbg_corruption(`check: ${msg}`);
  if (SFX.filter_dbg_have_save && SFX.filter_dbg_corrupted) {
    X.storage.data.filters = X.clone(SFX.filter_dbg_preserved_filters);
    SFX.filter_dbg_corrupted = false;
  }
};
SFX.filter_dbg_preserve_filters = function() {
  if (!SFX.filter_dbg_corrupted) {
    SFX.filter_dbg_have_save = true;
    SFX.filter_dbg_preserved_filters = X.clone(X.storage.data.filters);
  }
};

	const canonicalize_filter = function(filter, why) {
		var changed = false;

		// Make sure every filter has rules and actions
		if (!X.isArray(filter.rules)) {
SFX.filter_dbg_corruption('canonicalize: rules in ' + why, filter);
			changed = true;
			filter.rules = [];
		}
		if (!X.isArray(filter.actions)) {
SFX.filter_dbg_corruption('canonicalize: actions in ' + why, filter);
			changed = true;
			filter.actions = [];
		}
		// Convert {operator:'not_matches'} to {operator:'matches',not:true}
		filter.rules.forEach(function (rule) {
			if (X.isObject(rule)) {
				if (/^not_/.test(rule.operator)) {
					changed = true;
					rule.not = true;
					rule.operator = rule.operator.replace(/^not_/, '');
				}
				if (![ 'matches', 'contains_selector', ].includes(rule.operator)) {
					if (!rule.condition) {
						changed = true;
						rule.condition = {};
					}
					if (!rule.condition.modifier) {
						changed = true;
						rule.condition.modifier = (rule.operator == 'equals') ? 'I' : 'i';
					}
					if (!rule.matcher) {
						changed = true;
						rule.matcher = 're';
					}
				}
			}
		});
		return changed;
	};
	SFX.pose({ canonicalize_filter, });

	FX.on_options_load(function () {
		// Update Tweaks and Filters in the background every so often
		X.task('update_filter_subscriptions', 4 * X.hours, function () {
SFX.filter_dbg_preserve_filters();
			update_subscribed_items('filters', FX.storage('filters'), null, filter => canonicalize_filter(filter, 'update_filter_subscriptions'));
SFX.filter_dbg_check_filters('after update_filter_subscriptions');
		});
		X.task('update_tweak_subscriptions', 4 * X.hours, function () {
			update_subscribed_items('tweaks', FX.storage('tweaks'));
		});

		// Options Dialog
		var sections = [
			{'name': 'Search', 'description': 'Options with a title or description matching your search text (at least 3 characters) will appear below.'}
			, {'name': 'General', 'description': ''}
			, {'name': 'Hide Posts', 'description': ''}
			, {'name': 'Filters', 'description': ''}
			, {'name': 'Display Tweaks', 'description': ''}
			, {'name': 'Advanced', 'description': ''}
			, {'name': 'Experiments', 'description': 'These features are a work in progress, not fully functional, or possibly confusing to users.'}
			, {'name': 'Data', 'description': ''}
			, {'name': 'Support', 'url': 'https://matt-kruse.github.io/socialfixerdata/support.html', 'property': 'content_support'}
			, {'name': 'Donate', 'url': 'https://matt-kruse.github.io/socialfixerdata/donate.html', 'property': 'content_donate'}
			, {'name': 'About', 'url': 'https://matt-kruse.github.io/socialfixerdata/about.html', 'property': 'content_about'}
			, {'name': 'Debug', 'className':'sfx_debug_tab', 'description':`These are debugging tools to help developers and those needing support. These are not normal features. Play with them if you wish, or visit them if asked to by the Support Team.`}
		];
		var data = {
			"action_button": null
			, "show_action_buttons": true
			, "sections": sections
			, "filters": null
			, "show_filtering_tooltips": FX.option('show_filtering_tooltips')
			, "editing_meta": {}
			, "editing_filter": null
			, "filter_subscriptions": null
			, "tweak_subscriptions": null
			, "tweaks": null
			, "editing_tweak": null
			, "show_advanced": false
			, "options": FX.options
			, "user_options": ""
			, "user_options_message": null
			, "storage_size": JSON.stringify(X.storage.data).length
			, "supports_download_attribute": 'download' in document.createElement('a') // https://stackoverflow.com/a/12112905
			, "content_about": "Loading..."
			, "content_donate": "Loading..."
			, "sfx_option_show_donate": false
			, "content_support": "Loading..."
			, "support_notes": null
			, "searchtext":null
		};
		X.subscribe('menu/options', function (event, event_data) {
			if (!event_data) { event_data={}; }
			try {
				if (X('#sfx_options_dialog').length) {
					return;
				}

				// Prepare data for options dialog display.
				// We can't work on the real options object, in case the user cancels.
				// So we need to work on a copy, then overlay it when they save.

				// Convert the options into section-based options
				sections.forEach(function (section_object) {
					var sectionName = section_object.name;
					section_object.options = [];
					if (event_data.section) {
						section_object.selected = (event_data.section == sectionName);
					}
					else {
						section_object.selected = (sectionName == 'General');
					}
					for (var k in FX.options) {
						var opt = FX.options[k];
						if ((sectionName == 'General' && !opt.section) || (sectionName == opt.section)) {
							opt.newValue = opt.value = FX.option(opt.key);
							section_object.options.push(opt);
						}
						if (opt.title && opt.title==event_data.highlight_title) {
							opt.highlighted=true;
						}
					}

					section_object.options = section_object.options.sort(function (a, b) {
						var x = (a.title || "") + " " + (a.order || "") + " " + (a.description || "");
						var y = (b.title || "") + " " + (b.order || "") + " " + (b.description || "");
						if (x < y)
							return -1;
						if (x > y)
							return 1;
						return 0;
					});
				});

SFX.filter_dbg_preserve_filters();
				const filters = Object.values(X.clone(X.storage.data['filters'] || [])).filter(el => !!el);
				var changed = false;
				filters.forEach(filter => canonicalize_filter(filter, 'options setup') && (changed = true));
SFX.filter_dbg_check_filters('after options setup');
				if (changed) {
					X.storage.save('filters', filters);
				}
				data.filters = filters;

				const tweaks = Object.values(X.clone(X.storage.data['tweaks'] || [])).filter(el => !!el);
				data.tweaks = tweaks;

				if (X.support_notes) {
					data.support_notes = X.support_notes;
				}

				// Render the options dialog content
				var dialog = FX.oneLineLtrim(`<div id="sfx_options_dialog" class="sfx_dialog sfx-flex-column" style="transition: height .01s;">
	<div id="sfx_options_dialog_header" class="sfx_dialog_title_bar" style="cursor:move;" @click="collapse" v-tooltip="{content:'Click to window-shade, drag to move',position:'below'}">
		Social Fixer ${SFX.version}
		<div id="sfx_options_dialog_actions" v-if="show_action_buttons" draggable="false" >
			<input draggable="false" v-if="action_button=='done_editing_filter'" class="sfx_options_dialog_panel_button sfx_button" type="button" value="Done Editing Filter" @click.stop="close_filter">
			<input draggable="false" v-if="action_button=='done_editing_tweak'" class="sfx_options_dialog_panel_button sfx_button" type="button" value="Done Editing Tweak" @click.stop="close_tweak">
			<input draggable="false" v-if="!action_button" class="sfx_button" type="button" @click.stop="save" value="Save Changes">
			<input draggable="false" type="button" class="sfx_button secondary" @click.stop="cancel" value="Cancel">
		</div>
	</div>
	<div id="sfx_options_dialog_body" class="sfx-flex-row" draggable="false">
		<div id="sfx_options_dialog_sections">
			<template v-for="section in sections">
				<template v-if="section.name=='Search'">
					<div @click="select_section(section)" class="sfx_options_dialog_section {{section.selected?'selected':''}} {{section.className}}"><input class="sfx_input" style="width:90%;" placeholder="Search..." @keyup="search" v-model="searchtext"></div>
				</template>
				<template v-else>
					<div @click="select_section(section)" class="sfx_options_dialog_section {{section.selected?'selected':''}} {{section.className}}">{{section.name}}</div>
				</template>
			</template>
		</div>
		<div id="sfx_options_dialog_content">
			<div v-if="section.selected" v-for="section in sections" class="sfx_options_dialog_content_section">
				<template v-if="section.name=='Filters'">
					<div id="sfx_options_dialog_filters">
					    <div v-if="!editing_filter" class="sfx_options_dialog_filter_list">
					        <div class="">
					            <span class="sfx_button" style="float:right;background-color:green;" onclick="window.open('https://github.com/matt-kruse/SocialFixer/wiki/Post-Filtering#filter-list','SFX_FILTER_HELP','width=1024,height=600');"><b>[?]</b> Open Filter Help</span>
					            Post Filters let you hide posts, put them in tabs, or change their appearance based on their content. They execute in the order below for each post.
					            <br style="clear:both;">
					        </div>
					        <div class="sfx_option" style="margin:10px 10px;font-size:calc(0.7rem * var(--sfx_ui_scale));float:left;">
					            <input id="filters_enabled" type="checkbox" v-model="options.filters_enabled.newValue"/><label for="filters_enabled"></label> Post Filtering enabled
					        </div>
					        <div class="sfx_option" style="margin:10px 10px;font-size:calc(0.7rem * var(--sfx_ui_scale));float:left;">
					            <input id="filters_enabled_pages" type="checkbox" v-model="options.filters_enabled_pages.newValue"/><label for="filters_enabled_pages"></label> Filter on Pages/Timelines
					        </div>
					        <div class="sfx_option" style="margin:10px 10px;font-size:calc(0.7rem * var(--sfx_ui_scale));float:left;">
					            <input id="filters_enabled_groups" type="checkbox" v-model="options.filters_enabled_groups.newValue"/><label for="filters_enabled_groups"></label> Filter in Groups
					        </div>
					        <div class="sfx_options_dialog_panel_header" style="clear:both;">Active Filters</div>
					        <div>
					            <input type="button" class="sfx_button" value="Create A New Filter" @click="add_filter">
					        </div>
					        <table class="sfx_options_dialog_table">
					            <thead>
					            <tr>
					                <th>#</th>
					                <th>Title</th>
					                <th>Description</th>
					                <th style="text-align:center;">Actions</th>
					                <th style="text-align:center;">Stop On<br>Match</th>
					                <th style="text-align:center;">Enabled</th>
					            </tr>
					            </thead>
					            <tbody>
					            <tr v-for="(order,filter) in filters" v-bind:class="{'sfx_options_dialog_option_disabled':!filter.enabled}">
					                <td>{{order + 1}}</td>
					                <td class="sfx_options_dialog_option_title">{{filter.title}}<span v-if="filter.id" style="font-weight:normal;font-style:italic;color:green;margin-top:5px;" v-tooltip="{content:'Click \\'x\\' to unsubscribe',delay:250}"> (Subscribed)</span></td>
					                <td class="sfx_options_dialog_option_description">
					                    {{filter.description}}
					                    <div v-if="filter.id && filter.subscription_last_updated_on" style="font-style:italic;color:#999;margin-top:5px;">Subscription last updated: {{ago(filter.subscription_last_updated_on)}}</div>
					                </td>
					                <td class="sfx_options_dialog_option_action" style="white-space:nowrap;">
					                    <span class="sfx_square_control" v-tooltip="Edit" @click="edit_filter(filter,$index)">&#9998;</span>
					                    <span class="sfx_square_control sfx_square_delete"  v-tooltip="Delete" @click="delete_filter(filter)">&times;</span>
					                    <span class="sfx_square_control" v-tooltip="Move Up (Hold Ctrl to move to top)" @click="up(filter, $event)">&utrif;</span>
					                    <span v-if="$index<filters.length-1" class="sfx_square_control" v-tooltip="Move Down" @click="down(filter)">&dtrif;</span>
					                </td>
					                <td style="text-align:center;">
					                    <input id="sfx_stop_{{$index}}" type="checkbox" v-model="filter.stop_on_match"/><label for="sfx_stop_{{$index}}" data-tooltip-delay="100" v-tooltip="If a post matches this filter, don't process the filters that follow, to prevent it from being double-processed. For most situations, this should remain checked."></label>
					                </td>
					                <td style="text-align:center;">
					                    <input id="sfx_filter_{{$index}}" type="checkbox" v-model="filter.enabled"/><label for="sfx_filter_{{$index}}"></label>
					                </td>
					            </tr>
					            </tbody>
					        </table>

					        <div v-if="filter_subscriptions">
					            <div class="sfx_options_dialog_panel_header">Filter Subscriptions</div>
					            <div>The pre-defined filters below are available for you to use. These "Filter Subscriptions" will be automatically maintained for you, so as Facebook changes or more keywords are needed to match a specific topic, your filters will be updated without you needing to do anything!</div>
					            <table class="sfx_options_dialog_table">
					                <thead>
					                <tr>
					                    <th>Title</th>
					                    <th>Description</th>
					                    <th>Actions</th>
					                </tr>
					                </thead>
					                <tbody>
					                <tr v-for="filter in filter_subscriptions" v-bind:class="{'sfx_filter_subscribed':filter.subscribed}">
					                    <template v-if="version_check(filter)">
					                    <td class="sfx_options_dialog_option_title">{{filter.title}}<span v-if="filter.subscribed" style="font-weight:900;font-style:italic;color:green;margin-top:5px;" v-tooltip="{content:'To unsubscribe, click \\'x\\' in the Active Filters table above',delay:250}"> (Subscribed)</span></td>
					                    <td class="sfx_options_dialog_option_description">{{filter.description}}</td>
					                    <td class="sfx_options_dialog_option_action">
					                        <span class="sfx_square_add" v-tooltip="Add To My Filters" @click="add_subscription(filter)">+</span>
					                    </td>
					                    </template>
					                </tr>
					                </tbody>
					            </table>
					        </div>
					    </div>

					    <div v-if="editing_filter" class="sfx_options_dialog_panel">
					        <div style="float:right;">
					            <span class="sfx_button" style="background-color:green;" onclick="window.open('https://github.com/matt-kruse/SocialFixer/wiki/Post-Filtering#edit-filter','SFX_FILTER_HELP','width=1024,height=600');"><b>[?]</b> Open Filter Help</span>
					        </div>
					        <div class="sfx_panel_title_bar">
					            Edit Filter
					            <br style="clear:both;">
					        </div>
					        <div class="sfx_info" v-if="editing_filter.id">
					            This filter is a subscription, so its definition is stored on the SocialFixer.com server and updated automatically for you. If you wish to edit this filter, you can do so but it will "break" the subscription and your copy will be local and no longer updated automatically as Facebook changes.
					            <br><input type="button" class="sfx_button" value="Convert to local filter" @click="editing_filter.id=null"/>
					        </div>
					        <div class="sfx_label_value">
					            <div>Title:</div>
					            <div><input class="sfx_wide sfx_input" v-model="editing_filter.title" v-bind:disabled="editing_filter.id"/></div>
					        </div>
					        <div class="sfx_label_value">
					            <div>Description:</div>
					            <div><input class="sfx_wide sfx_input" v-model="editing_filter.description" v-bind:disabled="editing_filter.id"></div>
					        </div>
					        <div class="sfx_options_dialog_filter_conditions sfx_options_dialog_panel">
					            <div class="sfx_panel_title_bar">
					                IF ...
					                <br style="clear:both;">
					            </div>
					            <div v-for="rule in editing_filter.rules">
					                <div class="sfx-flex-row-container">
					                    <div><select v-if="$index>0" v-model="editing_filter.match" v-bind:disabled="editing_filter.id"><option value="ALL" data-tooltip-delay="100" v-tooltip="Choose whether all conditions must be met (AND) or if any of the conditions must be met (OR)">AND<option value="ANY">OR</select></div>
					                    <div><select v-model="rule.target" v-bind:disabled="editing_filter.id" data-tooltip-delay="100" v-tooltip="Which attribute of the post do you want to match on?\nSee the Filter Help for a full explanation of each type">
					                        <option value="any">Any Post Content</option>
					                        <option value="any+image">Post Text + Caption</option>
					                        <option value="content">Post Text Content</option>
					                        <option value="action">Post Action</option>
					                        <option value="author">Author</option>
					                        <option value="group">Group Posted In</option>
					                        <option value="page">Page Posted By</option>
					                        <option value="app">App/Game Name</option>
					                        <option value="link_url">Link URL</option>
					                        <option value="link_text">Link Text</option>
					                        <!--
					                        <option value="day">Day of the Week</option>
					                        <option value="age">Post Age</option>
					                        -->
					                        <option value="image">Photo Caption</option>
					                        <option value="hashtag">Any Hashtag</option>
					                    </select></div>
					                    <template v-if="rule.target=='day'">
					                        <div style="padding-left:10px;" data-tooltip-delay="100" v-tooltip="Choose which days of the week this filter should be active">
					                            is
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_0" v-bind:disabled="editing_filter.id"> Sun
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_1" v-bind:disabled="editing_filter.id"> Mon
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_2" v-bind:disabled="editing_filter.id"> Tue
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_3" v-bind:disabled="editing_filter.id"> Wed
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_4" v-bind:disabled="editing_filter.id"> Thu
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_5" v-bind:disabled="editing_filter.id"> Fri
					                            <input type="checkbox" class="normal" v-model="rule.condition.day_6" v-bind:disabled="editing_filter.id"> Sat
					                        </div>
					                    </template>
					                    <template v-if="rule.target=='age'">
					                        <div style="padding-left:10px;">
					                            is
					                            <select v-model="rule.operator" v-bind:disabled="editing_filter.id">
					                                <option value="gt">Greater Than</option>
					                                <option value="lt">Less Than</option>
					                            </select>
					                            <input class="sfx_input" type="number" min="1" style="width:40px;" v-model="rule.condition.value" size="3" v-bind:disabled="editing_filter.id">
					                            <select v-model="rule.condition.units" v-bind:disabled="editing_filter.id">
					                                <option value="h">Hours</option>
					                                <option value="d">Days</option>
					                            </select>
					                        </div>
					                    </template>
					                    <template v-if="rule.target!='day' && rule.target!='age'">
					                        <div>
					                            <input type="checkbox" class="normal" v-model="rule.not" v-bind:disabled="editing_filter.id"> NOT
					                        </div>
					                        <div>
					                            <select v-model="rule.operator" v-bind:disabled="editing_filter.id">
					                                <option value="contains">Contains</option>
					                                <option value="equals">Equals Exactly</option>
					                                <option value="startswith">Starts With</option>
					                                <option value="endswith">Ends With</option>
					                                <option value="matches">Matches Regex</option>
					                                <option v-if="rule.target=='any'" value="contains_selector">Matches CSS Selector</option>
					                            </select>
					                        </div>
					                        <div class="stretch" style="white-space:nowrap;">
					                            <span v-if="['matches',].includes(rule.operator)" style="margin-left:10px;font-weight:bold;">/</span>
					                            <input v-if="['contains','equals','startswith','endswith',].includes(rule.operator)" class="stretch sfx_input" v-on:focus="clear_test_regex" v-on:blur="test_regex" v-model="rule.condition.text" v-bind:disabled="editing_filter.id">
					                            <input v-if="['contains_selector',].includes(rule.operator)" class="stretch sfx_input" v-model="rule.condition.text" v-bind:disabled="editing_filter.id">
					                            <input v-if="['matches',].includes(rule.operator)" class="stretch sfx_input" v-model="rule.condition.text" style="max-width:70%;" v-bind:disabled="editing_filter.id">
					                            <div>
					                                <span style="white-space:normal;" v-if="'re'==rule.matcher && ['equals','contains',].includes(rule.operator)">word|or phrase|more of either|...</span>
					                            </div>
					                            <span v-if="['matches',].includes(rule.operator)" style="font-weight:bold;">/</span>
					                            <input class="sfx_input" v-if="['matches',].includes(rule.operator)" v-model="rule.condition.modifier" size="2" v-bind:disabled="editing_filter.id" data-tooltip-delay="100" v-tooltip="Regular Expression modifier, such as 'i' for case-insensitive">
					                            <template v-if="!['matches','contains_selector',].includes(rule.operator)">
					                                <select v-model="rule.condition.modifier" v-bind:disabled="editing_filter.id">
					                                    <option value="i">ignore case</option>
					                                    <option value="I">Match Case</option>
					                                </select>
					                                <select v-model="rule.matcher" v-bind:disabled="editing_filter.id">
					                                    <option value="re">Regular Expression</option>
					                                    <option value="str">Simple String Match</option>
					                                </select>
					                            </template>
					                            <span v-if="['contains',].includes(rule.operator)" style="white-space:nowrap;padding-left:5px;">
					                                <input type="checkbox" class="normal" v-model="rule.match_partial_words" v-bind:disabled="editing_filter.id" data-tooltip-delay="100" v-tooltip="Check this if you want the text to be a partial match. For example, if 'book' should also match 'Facebook'. If unchecked, only whole words will be matched.">
					                                <span v-if="(!editing_filter.id || rule.match_partial_words)"> Match partial words</span>
					                            </span>
					                            <span v-if="['matches',].includes(rule.operator)" class="sfx_link" @click="regex_test(rule.condition)" data-tooltip-delay="100" v-tooltip="Test your regular expression against text to make sure it matches as you expect."> [test]</span>
					                        </div>
					                    </template>
					                    <span v-if="editing_filter.rules.length>1" class="sfx_square_control sfx_square_delete" style="margin:0 10px;" v-tooltip="Delete" @click="delete_rule(rule)">&times;</span>
					                </div>
					            </div>
					            <div v-if="!editing_filter.id">
					                <input type="button" class="sfx_button" value="Add A Condition" @click="add_condition">
					            </div>
					        </div>
					        <div class="sfx_options_dialog_filter_actions sfx_options_dialog_panel">
					            <div class="sfx_panel_title_bar">... THEN</div>
					            <div class="sfx_info" v-if="editing_filter.id && editing_filter.configurable_actions && editing_filter.actions[0].action==''">
					                This Filter Subscription defines the rules above, but the action to take is up to you to define. When updated automatically, the rules above will be updated but your selected actions are personal to you.
					            </div>
					            <div class="sfx_info" v-if="editing_filter.id && editing_filter.configurable_actions && editing_filter.actions[0].action!=''">
					                The Actions to take when this filter subscription matches may be changed. If you change the actions, the criteria above will continue to be updated but your customized actions will not be over-written when the filter updates itself.
					            </div>
					            <div class="sfx-flex-row-container" v-for="action in editing_filter.actions">
					                <select v-model="action.action" v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions" data-tooltip-delay="100" v-tooltip="If the conditions match, what action should be taken on the post?">
					                    <option value=""></option>
					                    <option value="hide">Hide post</option>
					                    <option value="unhide">Unhide post</option>
					                    <option value="read">Mark post 'Read'</option>
					                    <option value="unread">Unmark post 'Read'</option>
					                    <option value="css">Add CSS</option>
					                    <option value="class">Add CSS Class</option>
					                    <option value="replace">Replace text</option>
					                    <option value="move-to-tab">Move post to tab</option>
					                    <option value="copy-to-tab">Copy post to tab</option>
					                </select>
					                <span v-if="action.action=='hide'">
					                    <input type="checkbox" class="normal" v-model="action.show_note"  data-tooltip-delay="100" v-tooltip="This will leave a small note in your feed to let you know that a post was hidden." v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions"> Show a note where the post would have been.
					                    <div v-if="action.show_note"> Optional Custom Reveal Note: <input class="sfx_input" v-model="action.custom_note" size="70" data-tooltip-delay="100" v-tooltip="Customize the click-to-reveal note text." style="margin-bottom:3px"></div>
					                    <div v-if="action.show_note"> Optional Custom Rehide Note: <input class="sfx_input" v-model="action.custom_nyet" size="70" data-tooltip-delay="100" v-tooltip="Customize the click-to-rehide note text."></div>
					                </span>
					                <span v-if="action.action=='css'">
					                    CSS: <input class="sfx_input" v-model="action.content" size="45" v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions">
					                    To Selector: <input class="sfx_input" v-model="action.selector" size="25" data-tooltip-delay="100" v-tooltip="Apply the CSS to the element(s) specified by the selector. To target the whole post container, leave blank." v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions">
					                </span>
					                <span class="stretch" v-if="action.action=='class'">
					                    Class: <input class="sfx_input" v-model="action.content" size="45" v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions" data-tooltip-delay="100" v-tooltip="Add a class name. This is useful in conjunction with a Display Tweak to customize CSS">
					                    To Selector: <input class="sfx_input" v-model="action.selector" size="25" data-tooltip-delay="100" v-tooltip="Apply the class to the element(s) specified by the selector. To target the whole post container, leave blank." v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions">
					                </span>
					                <span v-if="action.action=='replace'">
					                    Find: <input class="sfx_input" v-model="action.find" size="25" v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions">
					                    Replace With: <input class="sfx_input" v-model="action.replace" size="25" v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions">
					                </span>
					                <span v-if="action.action=='move-to-tab' || action.action=='copy-to-tab'">
					                    Tab Name: <input class="sfx_input" v-model="action.tab" size="45" v-bind:disabled="editing_filter.id && !editing_filter.configurable_actions">
					                </span>
					                <span v-if="editing_filter.actions.length>1" class="sfx_square_control sfx_square_delete" style="margin:0 10px;" v-tooltip="Delete" @click="delete_action(action)">&times;</span>
					            </div>
					            <div v-if="!editing_filter.id || editing_filter.configurable_actions">
					                <input type="button" class="sfx_button" value="Add An Action" @click="add_action">
					            </div>
					        </div>
					        <span data-tooltip-delay="100" v-tooltip="Directly move this filter to the given position number">
					            <input type="number" class="sfx_input" min="1" max="{{filters.length}}" v-model="editing_meta.new_number">Filter Order
					        </span>
					        <span data-tooltip-delay="100" v-tooltip="If a post matches this filter, don't process the filters that follow, to prevent it from being double-processed. For most situations, this should remain checked.">
					            <input type="checkbox" class="normal" v-model="editing_filter.stop_on_match">Stop On Match
					        </span>
					        <span data-tooltip-delay="100" v-tooltip="Should this filter be processed at all?">
					            <input type="checkbox" class="normal" v-model="editing_filter.enabled">Enabled
					        </span>
					        <div class="sfx_link" @click="show_advanced=!show_advanced" v-tooltip="{position:'above',content:'View the underlying JSON data structure for this filter. The filter can be edited manually here, or you can paste in filter code from someone else to copy their filter exactly.',delay:500}">{{show_advanced?"Hide Advanced Code &utrif;":"Show Advanced Code &dtrif;"}}</div>
					        <textarea v-if="show_advanced" style="width:90%;height:150px;font-size:calc(0.55rem * var(--sfx_ui_scale));font-family:monospace;" v-model="editing_filter | json+" v-bind:disabled="editing_filter.id"></textarea>
					    </div>
					</div>

				</template>
				<template v-if="section.name=='Data'">
					<div class="sfx_info">Here you can export all of Social Fixer's stored data, including options, filters, and which stories have been read. WARNING: Importing will overwrite your existing settings!</div>
					Total storage space used: {{storage_size | currency '' 0}} bytes<br><br>
					<input type="button" class="sfx_button" value="Save To File" @click="save_to_file()" v-if="supports_download_attribute"> <input type="button" class="sfx_button" value="Load From File" @click="load_from_file()"> <input type="button" class="sfx_button" value="Reset All Data" @click="reset_data()"><br><br>
					<input type="button" class="sfx_button" value="Export To Textbox" @click="populate_user_options()"> <input type="button" class="sfx_button" value="Import From Textbox" @click="import_data_from_textbox()">
					<br><br>
					<div v-if="user_options_message" class="sfx_info">{{user_options_message}}</div>
					<textarea id="sfx_user_data" v-model="user_options|json" style="width:95%;height:50vh;font-family:courier new,monospace;font-size:calc(0.55rem * var(--sfx_ui_scale));"></textarea>
				</template>
				<template v-if="section.name!='Filters'">
					<div v-if="section.description" style="margin-bottom:15px;">{{section.description}}</div>
					<table class="sfx_options_dialog_table">
						<tr v-for="opt in section.options | filterBy !opt.hidden" v-if="!opt.hidden" class="{{opt.highlighted?'sfx_options_dialog_option_highlighted':''}}">
							<td class="sfx_options_dialog_option_title {{($index==0 || section.options[$index-1].title!=opt.title)?'':'repeat'}}">{{{opt.title | highlight searchtext}}}</td>
							<td class="sfx_options_dialog_option_description">{{{opt.description | highlight searchtext}}}
								<input class="sfx_input" v-if="opt.type=='text'" v-model="opt.newValue" style="display:block;width:{{opt.width || '50%'}};"/>
								<input class="sfx_input" v-if="opt.type=='number'" type="number" min="{{opt.min||1}}" max="{{opt.max||999}}" v-model="opt.newValue"/>
								<textarea v-if="opt.type=='textarea'" v-model="opt.newValue" style="display:block;width:95%;height:100px;"></textarea>
							</td>
							<td class="sfx_options_dialog_option_action">
								<template v-if="opt.type=='checkbox'">
									<input id="sfx_option_{{opt.key}}" class="sfx_input" type="checkbox" v-model="opt.newValue"/><label for="sfx_option_{{opt.key}}"></label>
								</template>
								<template v-if="opt.type=='link'">
									<input type="button" data-href="{{opt.url}}" onclick="window.open(this.getAttribute('data-href'));" class="sfx_button" value="GO!">
								</template>
								<template v-if="opt.type=='action'">
									<input type="button" @click="message(opt.action_message)" class="sfx_button" value="{{opt.action_text}}">
								</template>
							</td>
						</tr>
					</table>

					<!-- Custom Section Displays -->
					<template v-if="section.name=='Hide Posts'">
						<b>Easily hide posts from your feed by keyword or phrase.</b>
						<br><br>
						Just enter each keyword or phrase you want to hide on a separate line in the text box. Any post containing one of those words will be hidden, and a small note will be shown in its place. To have more control over filtering, advanced post filtering can be setup in the "Filters" tab.
						<br><br>
						<input type="checkbox" class="normal" v-model="options.hide_posts_show_hidden_message.newValue"> Show a note in place of hidden posts in the news feed
						<br>
						<input type="checkbox" class="normal" v-model="options.hide_posts_show_match.newValue"> Show the word or phrase that matched in the hidden-post note
						<br>
						<input type="checkbox" class="normal" v-model="options.hide_posts_partial.newValue"> Match partial words (example: "the" will also match "them")
						<br>
						<input type="checkbox" class="normal" v-model="options.hide_posts_case_sensitive.newValue"> Match Case
						<br>
						<input type="checkbox" class="normal" v-model="options.hide_posts_caption.newValue"> Also match photo captions
						<br>
						Hide posts with these keywords or phrases (each on its own line):<br>
						<textarea v-model="options.hide_posts_text.newValue" style="width:80%;height:150px;"></textarea>

					</template>
					<template v-if="section.name=='Display Tweaks'">
						<div v-if="!editing_tweak">
						    <div class="">
						        Display Tweaks are small snippets of CSS which change the appearance of the page. They can do anything from changing colors and fonts to hiding parts of the page or completely changing the layout. Advanced users can add their own tweaks, but most users will want to select some from the list of available Tweaks.
						    </div>
						    <div class="sfx_option" style="margin:10px 0;font-size:calc(0.7rem * var(--sfx_ui_scale));"><input id="tweaks_enabled" type="checkbox" v-model="options.tweaks_enabled.newValue" @change="show_current_tweaks()"/><label for="tweaks_enabled"></label> Tweaks enabled</div>
						    <div>
						        <input type="button" class="sfx_button" value="Create A New Tweak" @click="add_tweak">
						    </div>
						    <div v-if="tweaks.length" class="sfx_options_dialog_panel_header">Active Tweaks</div>
						    <table v-if="tweaks.length" class="sfx_options_dialog_table">
						        <thead>
						        <tr>
						            <th>#</th>
						            <th>Title</th>
						            <th>Description</th>
						            <th style="text-align:center;">Actions</th>
						            <th style="text-align:center;">Enabled</th>
						        </tr>
						        </thead>
						        <tbody>
						        <tr v-for="(order,tweak) in tweaks" v-if="isObject(tweak)" v-bind:class="{'sfx_options_dialog_option_disabled':!tweak.enabled}">
						            <td>{{order + 1}}</td>
						            <td class="sfx_options_dialog_option_title">{{tweak.title}}<span v-if="tweak.id" style="font-weight:normal;font-style:italic;color:green;margin-top:5px;" v-tooltip="{content:'Click \\'x\\' to unsubscribe',delay:250}"> (Subscribed)</span></td>
						            <td class="sfx_options_dialog_option_description">
						                {{tweak.description}}
						                <div v-if="tweak.id && tweak.subscription_last_updated_on" style="font-style:italic;color:#999;margin-top:5px;">Subscription last updated: {{ago(tweak.subscription_last_updated_on)}}</div>
						            </td>
						            <td class="sfx_options_dialog_option_action" style="white-space:nowrap;">
						                <span class="sfx_square_control" v-tooltip="Edit" @click="edit_tweak(tweak,$index)">&#9998;</span>
						                <span class="sfx_square_control sfx_square_delete" v-tooltip="Delete" @click="delete_tweak(tweak)">&times;</span>
						            </td>
						            <td>
						                <input id="sfx_tweak_{{$index}}" type="checkbox" @change="toggle_tweak(tweak,$index)" v-model="tweak.enabled"/><label for="sfx_tweak_{{$index}}"></label>
						            </td>
						        </tr>
						        </tbody>
						    </table>

						    <div v-if="tweak_subscriptions">
						        <div class="sfx_options_dialog_panel_header">Available Display Tweaks (Snippets)</div>
						        <div>
						            Below is a list of display tweaks maintained by the Social Fixer team which you may find useful. When you add them to your list, they will be automatically updated to continue functioning if Facebook changes its layout or code.
						        </div>
						        <table class="sfx_options_dialog_table">
						            <thead>
						            <tr>
						                <th>Title</th>
						                <th>Description</th>
						                <th>Add</th>
						            </tr>
						            </thead>
						            <tbody>
						            <tr v-for="tweak in tweak_subscriptions" v-if="isObject(tweak)" v-bind:class="{'sfx_tweak_subscribed':tweak.subscribed}">
						                <template v-if="version_check(tweak)">
						                <td class="sfx_options_dialog_option_title">{{tweak.title}}<span v-if="tweak.subscribed" style="font-weight:900;font-style:italic;color:green;margin-top:5px;" v-tooltip="{content:'To unsubscribe, click \\'x\\' in the Active Tweaks table above',delay:250}"> (Subscribed)</span></td>
						                <td class="sfx_options_dialog_option_description">{{tweak.description}}</td>
						                <td class="sfx_options_dialog_option_action">
						                    <span class="sfx_square_add" v-tooltip="Add To My Tweaks" @click="add_tweak_subscription(tweak)">+</span>
						                </td>
						                </template>
						            </tr>
						            </tbody>
						        </table>
						    </div>
						    <div v-else>
						        Loading Available Tweaks...
						    </div>
						</div>

						<div v-if="editing_tweak" class="sfx_options_dialog_panel">
						    <div class="sfx_panel_title_bar">Edit Tweak</div>
						    <div class="sfx_label_value">
						        <div>Title:</div>
						        <div><input class="sfx_wide" v-model="editing_tweak.title"></div>
						    </div>
						    <div class="sfx_label_value">
						        <div>Description: </div>
						        <div><input class="sfx_wide" v-model="editing_tweak.description"></div>
						    </div>
						    <span data-tooltip-delay="100" v-tooltip="Directly move this tweak to the given position number">
						        <input type="number" class="sfx_input" min="1" max="{{tweaks.length}}" v-model="editing_meta.new_number">Tweak Order
						    </span>
						    <span data-tooltip-delay="100" v-tooltip="Should this tweak be processed at all?">
						        <input type="checkbox" class="normal" v-model="editing_tweak.enabled">Enabled
						    </span>
						    <div>CSS:<br/>
						        <textarea style="width:90%;height:250px;font-size:calc(0.55rem * var(--sfx_ui_scale));font-family:monospace;" v-model="editing_tweak.css"></textarea>
						    </div>
						</div>

					</template>
					<template v-if="section.name=='About'"><div id="sfx_options_content_about">{{{content_about}}}</div></template>
					<template v-if="section.name=='Donate'">
						<div v-if="sfx_option_show_donate" style="margin-bottom:10px;">
							<input id="sfx_option_show_donate" type="checkbox" v-model="options.sfx_option_show_donate.newValue"/><label for="sfx_option_show_donate"></label> Remind me every so often to help support Social Fixer through donations.
						</div>
						<div id="sfx_options_content_donate">{{{content_donate}}}</div>
					</template>
					<template v-if="section.name=='Support'">
						<div style="font-family:monospace;font-size:calc(0.55rem * var(--sfx_ui_scale));border:1px solid #ccc;margin-bottom:5px;padding:7px;">${SFX.user_agent}<br>Social Fixer ${SFX.buildstr}
							<br><span>Extension build target: ${SFX.extension_build_target}</span>
							<br><span>Extension store name: ${SFX.extension_store_name}</span>
							<br><span>Extension ID: ${SFX.extension_id}</span>
							<br><span v-if="support_notes"><br>Support Notes:<br>
								<span v-for="note in support_notes">{{note.who}}: {{note.what}}<br></span>
							</span>
						</div>
						<div id="sfx_options_content_support">{{{content_support}}}</div>
					</template>
				</template>
			</div>
		</div>
	</div>
</div>
`);
				var close_options = function () {
					X('#sfx_options_dialog').remove();
				};
				X.subscribe('options/close', function () {
					close_options();
				});

				// Record some tidbits in the save file which will be useful
				// for support purposes, if a settings file is submitted
				const update_support_data = function() {
					X.storage.set('stats', 'support', {
						user_agent: SFX.user_agent,
						extension_id:  SFX.extension_id,
						buildstr: SFX.buildstr,
						context: FX.context,
						support_notes: X.support_notes,
					});
				};

				var save_options = function () {
					var undef, opt, key, options_to_save = {};
					// Iterate each option
					for (key in FX.options) {
						opt = FX.options[key];
						// Only save non-default settings that have changed
						if (opt.newValue != opt.value) {
							// If it's the default, erase it from options so it will be overriden by the default
							if (opt.newValue == opt['default']) {
								options_to_save[key] = undef;
							}
							else {
								options_to_save[key] = opt.newValue;
							}
						}
					}
					// Store the data in memory
					X.storage.data.filters = X.clone(filters || []);
					X.storage.data.tweaks = X.clone(tweaks || []);

					// persist
					update_support_data();
					X.storage.set('options', options_to_save, function () {
						X.storage.save('filters', null, function () {
							X.storage.save('tweaks', null, function () {
								Object.keys(options_to_save).forEach(
									key => FX.fire_option_update(key, FX.option(key))
								);
								close_options();
								const position = (FX.option('badge_x') < 0) ? 'left' : 'right';
								var note = sticky_note(SFX.badge_sel, position, ' Saved!  <b style="color:red;">Reload all Facebook tabs</b> for changes to take effect! ');
								setTimeout(function () {
									note.remove();
								}, 6 * X.seconds);
							});
						});
					});
				};

				var insist_refresh = function (msg) {
					var note = `<div>${msg}<br><br><span class="sfx_button">REFRESH THE PAGE</span> immediately to activate the changes!`;
					data.show_action_buttons = false;
					X('#sfx_options_dialog_body').css("padding","50px").html(note);
					X('#sfx_options_dialog_body .sfx_button').click(() => window.location.reload());
				};

				var import_data = function (json) {
					var key, user_data;
					var keys = [];
					this.user_options_message = null;
					try {
						user_data = JSON.parse(json);
						for (key in user_data) {
							var d = X.clone(user_data[key]);
							X.storage.data[key] = d;
							X.storage.save(key, null, function () {
							});
							keys.push(key);
						}
						insist_refresh(`Successfully imported keys: ${keys.join(", ")}.`);
					} catch (e) {
						this.user_options_message = "Error importing data: " + e.toString();
					}
				};

				var key;
				if (event_data && event_data.data) {
					for (key in event_data.data) {
						data[key] = event_data.data[key];
					}
				}
				var methods = {
					"save": save_options
					, "cancel": function () {
						if (this.editing_filter) {
							if (this.editing_meta.new) {
								this.filters.length--;
							}
							this.action_button = null;
							this.editing_filter = null;
							this.editing_meta = {};
						}
						else if (this.editing_tweak) {
							if (this.editing_meta.new) {
								this.tweaks.length--;
							}
							this.action_button = null;
							this.editing_tweak = null;
							this.editing_meta = {};
						}
						else {
							close_options();
						}
					}
					, "collapse": function () {
						X('#sfx_options_dialog_body').toggle();
					}
					, "message": function (msg) {
						if (msg) {
							var messages = msg.split(/\s*,\s*/);
							if (messages && messages.length > 0) {
								messages.forEach(function (m) {
									X.publish(m, {});
								});
							}
						}
					}
					, "search": function() {
						var search_section = this.sections[0];
						search_section.options.splice(0,search_section.options.length);
						if (this.searchtext && this.searchtext.length>2) {
							var regex = new RegExp(this.searchtext,"i");
							for (var k in FX.options) {
								var opt = FX.options[k];
								if (regex.test(opt.title) || regex.test(opt.description)) {
									search_section.options.push(opt);
								}
							}
						}
					}
					, "select_section": function (section) {
						this.editing_filter = null;
						this.action_button = null;
						sections.forEach(function (s) {
							s.selected = false;
						});
						section.selected = true;
						X.publish("menu/options/section", section.name);
					}
					, "ago": X.ago
					, "isObject": X.isObject
					, "version_check": function (thingy) {
						return ((!thingy.min_version || X.semver_compare(SFX.version, thingy.min_version) >= 0) && (!thingy.max_version || X.semver_compare(SFX.version, thingy.max_version) <= 0));
					}
					, "clear_test_regex": function (ev) {
						var input = X(ev.target);
						input.attr('title', null).css('background-color', '');
					}
					, "test_regex": function (ev) {
						var input = X(ev.target);
						try {
							new RegExp(input.val());
							input.css('background-color', '');
						}
						catch (e) {
							input.css('background-color', '#e00');
							input.attr('title', e.message);
						}
					}
					, "save_to_file": function () {
						update_support_data();
						// Firefox requires link to be inserted in <body> before clicking
						// https://stackoverflow.com/a/27116581
						var $link = X('<a style="position:absolute;top:0;left:-10px;visibility:hidden;" aria-hidden="true" tabindex="-1"></a>');
						$link.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(X.storage.data, null, '  ')));
						$link.attr('download', `Social_Fixer_Settings_${X.today()}.txt`);
						X(document.body).append($link);
						X.ui.click($link, false);
						$link.remove();
					}
					, "load_from_file": function () {
						var $input = X('<input type="file" accept="text/*">');
						$input.change(function (ev) {
							if (ev.target.files && ev.target.files[0]) {
								var reader = new FileReader();

								reader.onload = function (e) {
									import_data.call(this, e.target.result);
								}.bind(this);

								reader.onerror = function (e) {
									this.user_options_message = 'Error importing data: ' + e.toString();
								}.bind(this);

								reader.readAsText(ev.target.files[0]);
							}
						}.bind(this));
						X.ui.click($input, false);
					}
					, "populate_user_options": function () {
						update_support_data();
						this.user_options = X.clone(X.storage.data);
						this.user_options_message = null;
					}
					, "import_data_from_textbox": function () {
						import_data.call(this, X('#sfx_user_data').val());
					}
					, "reset_data": function () {
						if (confirm('Are you sure?\n\nResetting your data will ERASE all user preferences, "read" story data, installed filters, etc.')) {
							X.storage.save('options', {});
							X.storage.save('filters', []);
							X.storage.save('tweaks', []);
							X.storage.save('hiddens', {});
							X.storage.save('postdata', {});
							X.storage.save('friends', {});
							X.storage.save('stats', {});
							X.storage.save('messages', {});
							X.storage.save('tasks', {});
							insist_refresh('All data has been reset.');
						}
					}
					// FILTERS
					, "edit_filter": function (filter, index) {
						this.editing_filter = X.clone(filter);
						this.editing_meta.number = index + 1;
						this.editing_meta.new_number = index + 1;
						this.editing_meta = X.clone(this.editing_meta);
						this.action_button = 'done_editing_filter';
					}
					, "delete_filter": function (filter) {
						if (confirm('Are you sure you want to remove this filter?')) {
							this.filters.$remove(filter);
							mark_subscribed_items(data.filter_subscriptions, filters);
						}
					}
					, "up": function (filter,$event) {
						if ($event.ctrlKey) {
							this.filters.$remove(filter);
							this.filters.unshift(filter);
						}
						else {
							for (var i = 0; i < this.filters.length; i++) {
								if (this.filters[i] == filter && i > 0) {
									this.filters.$set(i, this.filters[i - 1]);
									this.filters.$set(i - 1, filter);
									return;
								}
							}
						}
					}
					, "down": function (filter) {
						for (var i = 0; i < this.filters.length; i++) {
							if (this.filters[i] == filter && i < this.filters.length - 1) {
								this.filters.$set(i, this.filters[i + 1]);
								this.filters.$set(i + 1, filter);
								return;
							}
						}
					}
					, "close_filter": function () {
						this.editing_filter.updated_on = X.time();
						// If it's a subscription and actions are configurable and they have changed, flag as such
						var orig = this.filters[this.editing_meta.number - 1];
						if (orig.id && orig.configurable_actions && !orig.custom_actions) {
							if (!SFX.data_equals(orig.actions, this.editing_filter.actions)) {
								// Updated actions!
								this.editing_filter.custom_actions = true;
							}
						}
						var src = this.editing_meta.number - 1;
						var tgt = this.editing_meta.new_number - 1;
						// Shuffle things around if position was changed
						// splice() would break Vue
						if (src != tgt && tgt >= 0 && tgt < this.filters.length) {
							var idx, jdx, inc = (tgt - src) / Math.abs(tgt - src);
							for (idx = src; idx != tgt; idx = jdx) {
								jdx = idx + inc;
								this.filters.$set(idx, this.filters[jdx]);
							}
						} else {
							tgt = src;
						}
						this.filters.$set(tgt, this.editing_filter);
						this.editing_filter = null;
						this.action_button = null;
						this.editing_meta = {};
						mark_subscribed_items(data.filter_subscriptions, filters);
					}
					, "add_filter": function () {
						var new_filter = {match: 'ALL', enabled: true, stop_on_match: true, rules: [{target: 'any', operator: 'contains', matcher: 're', condition: { modifier:'i'}}], actions: [{action: 'hide'}]};
						new_filter.added_on = X.time();
						this.filters.push(new_filter);
						this.editing_meta.new = true;
						this.edit_filter(this.filters[this.filters.length - 1], this.filters.length - 1);
					}
					, "add_subscription": function (filter) {
						var f = X.clone(filter);
						f.enabled = true;
						if (!f.actions || !f.actions.length) {
							f.actions = [{"action": ""}];
							f.configurable_actions = true;
						}
						this.filters.push(f);
						mark_subscribed_items(data.filter_subscriptions, filters);
						//if (f.configurable_actions) {
						//	// Immediately invoke editor if it has configurable actions?
						//	this.edit_filter(this.filters[this.filters.length - 1], this.filters.length - 1);
						//}
					}
					, "add_condition": function () {
						this.editing_filter.rules.push({target: 'any', operator: 'contains', matcher: 're', condition: {modifier: 'i'}});
					}
					, "delete_rule": function (rule) {
						this.editing_filter.rules.$remove(rule);
					}
					, "add_action": function () {
						this.editing_filter.actions.push({});
					}
					, "delete_action": function (action) {
						this.editing_filter.actions.$remove(action);
					}
					, "regex_test": function (condition) {
						var text = condition.text;
						var modifier = condition.modifier;
						X.publish("test/regex", {"text": text, "modifier": modifier});
					}
					// TWEAKS
					, "edit_tweak": function (tweak, index) {
						this.editing_tweak = X.clone(tweak);
						this.editing_meta.number = index + 1;
						this.editing_meta.new_number = index + 1;
						this.editing_meta = X.clone(this.editing_meta);
						this.action_button = 'done_editing_tweak';
					}
					, "tweak_css_on_off": function (index, enabled) {
						enabled = enabled && this.options.tweaks_enabled.newValue;
						X.css(enabled ? this.tweaks[index].css : null, 'sfx_tweak_style_' + index);
					}
					, "delete_tweak": function (tweak) {
						if (confirm('Are you sure you want to remove this tweak?')) {
							this.tweaks.$remove(tweak);
							this.show_current_tweaks();
							mark_subscribed_items(data.tweak_subscriptions, tweaks);
						}
					}
					, "close_tweak": function () {
						this.editing_tweak.updated_on = X.time();
						var src = this.editing_meta.number - 1;
						var tgt = this.editing_meta.new_number - 1;
						// Shuffle things around if position was changed
						// splice() would break Vue
						if (src != tgt && tgt >= 0 && tgt < this.tweaks.length) {
							var idx, jdx, inc = (tgt - src) / Math.abs(tgt - src);
							for (idx = src; idx != tgt; idx = jdx) {
								jdx = idx + inc;
								this.tweaks.$set(idx, this.tweaks[jdx]);
								this.tweak_css_on_off(idx, X.isObject(this.tweaks[idx]) && this.tweaks[idx].enabled);
							}
						} else {
							tgt = src;
						}
						this.tweaks.$set(tgt, this.editing_tweak);
						this.tweak_css_on_off(tgt, this.editing_tweak.enabled);
						this.editing_tweak = null;
						this.action_button = null;
						this.editing_meta = {};
						mark_subscribed_items(data.tweak_subscriptions, tweaks);
					}
					, "add_tweak": function () {
						var new_tweak = {"title": "", "description": "", "enabled": true};
						new_tweak.added_on = X.time();
						var index = this.tweaks.push(new_tweak) - 1;
						this.editing_meta.new = true;
						this.edit_tweak(this.tweaks[index], index);
					}
					, "add_tweak_subscription": function (tweak) {
						var o = X.clone(tweak);
						o.enabled = true;
						var index = this.tweaks.push(o) - 1;
						mark_subscribed_items(data.tweak_subscriptions, tweaks);
						this.tweak_css_on_off(index, true);
					}
					, "toggle_tweak": function (tweak, index) {
						this.tweak_css_on_off(index, X.isObject(tweak) && tweak.enabled);
					}
					, "show_current_tweaks": function () {
						for (var index = 0; index < this.tweaks.length; index++) {
							this.tweak_css_on_off(index, X.isObject(this.tweaks[index]) && this.tweaks[index].enabled);
						}
						this.tweak_css_on_off(this.tweaks.length, false);
					}
				};
				template(document.body, dialog, data, methods).ready(function () {
					X.draggable('#sfx_options_dialog');

					// If a default section was passed in, publish that event
					if (event_data.section) {
						X.publish("menu/options/section", event_data.section);
					}
				});
			} catch (e) {
				alert(e);
			}
		});

		X.subscribe("menu/options/section", function (msg, msgdata) {
			// If the section has dynamic data, load it
			sections.forEach(function (s) {
				if (s.name == msgdata && s.property && s.url) {
					X.ajax(s.url, function (content) {
						data[s.property] = X.sanitize(content);
					});
				}
			});
			if (msgdata == "Filters") {
				// Retrieve filters
SFX.filter_dbg_preserve_filters();
				retrieve_item_subscriptions('filters', data.filters, function (subscriptions) {
					data.filter_subscriptions = subscriptions;
					update_subscribed_items('filters', data.filters, null, filter => canonicalize_filter(filter, 'filters menu'));
SFX.filter_dbg_check_filters('after opening filters menu');
				});
			}
			if (msgdata == "Display Tweaks") {
				// Retrieve tweaks
				retrieve_item_subscriptions('tweaks', data.tweaks, function (subscriptions) {
					data.tweak_subscriptions = subscriptions;
					update_subscribed_items('tweaks', data.tweaks);
				});
			}
		});

		// If opening from an "options" url, open options immediately
		FX.on_content_loaded(function () {
			if (/sfx_options=true/.test(location.href)) {
				X.publish("menu/options");
			}
		});
	});
});

// 'Permalinks' (Notifications & comment/reply timestamps) point to a
// specific comment/reply; but FB's own code only manages to scroll a
// post to the targeted item a small fraction of the time.  Fix that.

X.ready('permalink_target', function() {
 const add_options = function() {
  FX.add_option('permalink_target', {
    section:     'Advanced',
    title:       'Scroll To Comment',
    description: 'Scroll into view the comment / reply target of a clicked notification or permalink',
    order:       10,
    default:     true,
    live:        set_enabled,
  });
  FX.add_option('permalink_target_css', {
    section:     'Advanced',
    title:       'Scroll To Comment',
    description: 'CSS style to apply to that comment / reply ("this:that;other:etc"; blank for none)',
    type:        'text',
    order:       20,
    default:     'border:3px dashed #4c4;background-color:var(--progress-ring-disabled-foreground);',
    live:        set_target_css,
  });
 };

  var permalink_id = '';
  var permalink_selector = '';
  // Are we looking for a new (different) permalink?
  const new_permalink = function() {
    var url_params = location.search.replace(/^\?/, '').split('&');
    // First two are for www.facebook.com
    // 'ctoken=' sometimes appears in m and/or mbasic.facebook.com comment links
    // These are also right for 'new FB' permalinks
    var notif_target = url_params.find(param => /^reply_comment_id=/.test(param)) ||
      url_params.find(param => /^comment_id=/.test(param)) ||
      url_params.find(param => /^ctoken=/.test(param));
    if (!notif_target) {
      permalink_id = '';
      return false;
    }
    var notif_target_id = notif_target.replace(/.*[=_]/, '');
    if (permalink_id == notif_target_id) {
      return false;
    } else {
      permalink_id = notif_target_id;
      permalink_selector = `[role=article] a[href*="${notif_target}"]`;
      return true;
    }
  };

  // Unmark marked permalink when option becomes disabled, or clicking a new link
  const unmark = function() {
    X('.sfx_permalink_target').removeClass('sfx_permalink_target');
  };

  // The target has appeared, scroll to it!
  const target_appears_immediate = function() {
      // X.when() passes a $target, but re-acquire it because
      // FB may have rewritten the HTML during loading.
      const $container = X(permalink_selector).first().closest('[role=article]');
      if ($container.length) {
          unmark();
          $container.addClass('sfx_permalink_target');
          setTimeout(() => {
              $container[0].scrollIntoView();
              const top_tgt = $container.offset().top - (window.innerHeight / 2);
              window.scrollTo(0, top_tgt < 0 ? 0 : top_tgt);
          }, 0.75 * X.seconds);
      }
  };

  const target_appears = function() {
    // On clicking a comment timestamp, target already exists in
    // the current page: pause to allow new page load to start.
    setTimeout(target_appears_immediate, 1 * X.seconds);
  };

  const visibility_changed = function() {
    if (FX.option('permalink_target') &&
      document.visibilityState == 'visible' &&
      new_permalink()) {
      X.when(permalink_selector, target_appears, 500, 100);
    }
  };
  document.addEventListener('visibilitychange', visibility_changed);

  const set_target_css = function(css) {
    if (!FX.option('permalink_target') || typeof css != 'string' || !/[\S]/.test(css)) {
        css = ''; // Remove it
    } else {
        css = `.sfx_permalink_target { ${css} }`;
    }
    X.css(css, 'sfx_permalink_target_css');
  };
  const set_enabled = function(enabled) {
    if (enabled) {
      permalink_id = '';
      visibility_changed();
    } else {
      unmark();
    }
    set_target_css(FX.option('permalink_target_css'));
  };
  X.subscribe('post/action/permalink_target/scroll_to', target_appears_immediate);
  X.publish('post/action/add', {section: 'wrench', label: 'Scroll To Comment', order: 20, message: 'post/action/permalink_target/scroll_to'});

  // This fires on each click to new venue, making this work even
  // when FB's code controls the page replacement mechanism.
  const page_loaded = function() {
    permalink_id = '';
    visibility_changed();
  };
  add_options();
  FX.on_page_load(page_loaded);
});

X.ready( 'photo_tags', function() {
	FX.add_option('photo_tags', {
		"section": "General"
		, "title": "Show Photo Tags"
		, "description": "Display the descriptive tags (captions) that Facebook automatically puts on photos when you hover over them."
		, "default": false
	});
	FX.on_option('photo_tags', function() {
		FX.on_selector('[sfx_post] img[class][alt]:not([alt=""]', function($img) {
			$img.closest('a,.S2F_pos_rel').attr('sfx_photo_tags',$img.attr('alt'));
		});
	});
});

// =====================================================
// Apply Filters to posts when they are added or updated
// =====================================================
// Filters depend on options, so wait until they load
X.ready('post_filters', function() {
    FX.add_option('filters_enabled', {"section": "Filters", "hidden": true, "default": true});
    FX.add_option('filters_enabled_pages', {"section": "Filters", "hidden": true, "default": false});
    FX.add_option('filters_enabled_groups', {"section": "Filters", "hidden": true, "default": false});
    FX.add_option('filters_forced_processing_delay', {"type":"number", "section":"Advanced", "title":"Post Filter Force Delay", "description":"The time in ms after which post filtering will be forced even if all the content is not yet available", "default": 1 * X.seconds});
    FX.add_option('filter_forced_visible_style', {section: 'Advanced', title: 'Post Filter Visible Style', description: 'CSS style to be applied to filtered posts which have been clicked visible', type: 'text', default: 'border:2px dashed blue;', live: style => X.css(`.sfx_filter_hidden > :not(.sfx_filter_hidden_note) { ${style} }`, 'sfx_filter_visible_css')});

    FX.add_option('hide_posts_text', {"hidden":true, "type":"textarea", "section":"Hide Posts", "title":"Hide Posts Keywords", "default":""});
    FX.add_option('hide_posts_show_hidden_message', {"hidden":true, "section":"Hide Posts", "title":"Show hidden post message", "default":true});
    FX.add_option('hide_posts_show_match', {"hidden":true, "section":"Hide Posts", "title":"Show Matching Text", "default":true});
    FX.add_option('hide_posts_partial', {"hidden":true, "section":"Hide Posts", "title":"Match Partial Words", "default":true});
    FX.add_option('hide_posts_case_sensitive', {"hidden":true, "section":"Hide Posts", "title":"Case Sensitive", "default":false});
    FX.add_option('hide_posts_caption', {hidden:true, section:'Hide Posts', title:'Caption', default:true});
    const reveal_str = ' -- Click to reveal post';
    const rehide_str = ' -- Click to rehide post';

    const sfx_post_data = {};
    const sfx_filter_trace = {};
    SFX.pose({ sfx_post_data, sfx_filter_trace, });
    var filter_trace_reset_time = performance.now();
    const filter_trace = function (id, message) {
        const t1 = performance.now();
        var t0 = sfx_filter_trace[id] ? sfx_filter_trace[id][0] : t1;
        if (!sfx_filter_trace[id] || t0 < filter_trace_reset_time) {
            t0 = t1;
            sfx_filter_trace[id] = [t0];
            filter_trace(id, `Filter log for ID ${id} starts at page time ${(t0 / X.seconds).toFixed(6)}`);
        }
        sfx_filter_trace[id].push(((t1 - t0) / X.seconds).toFixed(6) + ' ' + message);
    };
    X.subscribe("log/filter", function (msg, data) {
        filter_trace(data.id, data.message);
    });
    X.subscribe_backlog('posts/reset', () => (filter_trace_reset_time = performance.now()));

    // Convert a string such that converting it to a RegExp makes a
    // RegExp which searches for that exact string with no special
    // meanings.  Code from github.com/tc39/proposal-regex-escaping/.
    function regexp_escape_literal(regex_str) {
        return regex_str.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var group_link_selector = "h4 a[href*='/groups/']";

    const init_post_filters = function() {
      FX.on_options_load(function () {
        X.unsubscribe(init_post_filters);
        var FORCED_PROCESSING_DELAY = +FX.option('filters_forced_processing_delay');

        var show_filtering_disabled_message_displayed = false;
        var show_filtering_disabled_message = function () {
            if (show_filtering_disabled_message_displayed) {
                return;
            }
            show_filtering_disabled_message_displayed = true;
            var msg = "By default, post filtering only affects the main Newsfeed.<br>You can change this in Options if you wish.";
            context_message("filter_disabled_message", msg, {"title": "Post Filtering Disabled"});
        };
        FX.on_page_unload(function () {
            show_filtering_disabled_message_displayed = false;
        });

        var filters = X.clone(FX.storage('filters'));

        // If there are any "Hide Posts" keywords defined, create a filter to hide them
        var hide_posts_text = (FX.option('hide_posts_text') || '').trim();
        if (hide_posts_text) {
            var keywords = regexp_escape_literal(hide_posts_text).split(/\s*\n\s*/);
            var keywords_regex = "(" + keywords.join('|') + ")";
            if (!FX.option('hide_posts_partial')) {
                keywords_regex = "(?:^|\\b|\\W)" + keywords_regex + "(?:\\W|\\b|$)";
            }
            var modifier = FX.option('hide_posts_case_sensitive') ? 'I' : 'i';
            var show_note = FX.option('hide_posts_show_hidden_message');
            const note = 'Post Hidden by keyword' + (FX.option('hide_posts_show_match')?': $1':'');
            var filter = {
                "match": "ALL",
                "enabled": true,
                "stop_on_match": true,
                "rules": [
                    {
                        target: FX.option('hide_posts_caption') ? 'any+image' : 'any',
                        "operator": "matches",
                        "condition": {
                            "text": keywords_regex,
                            "modifier": modifier
                        }
                    }
                ],
                "actions": [
                    {
                        "action": "hide",
                        "show_note": show_note,
                        custom_note: note + reveal_str,
                        custom_nyet: note + rehide_str,
                    }
                ],
                "title": "Hide Posts"
            };
            filters.unshift(filter);
        }

        const decide_filter_post_internal = function (post, dom_id) {
            const cuz = (why, ret) => (filter_trace(dom_id, 'Not filtering post because ' + why), ret || false);
            // If the post has already been properly filtered, don't do anything
            if (post.attr('sfx_filtered')) {
                if (!sfx_post_data[dom_id].already_msgd) {
                    cuz('it was already filtered');
                    sfx_post_data[dom_id].already_msgd = true;
                }
                return 'already';
            }

            if (!post || !post[0]) {
                return cuz("it apparently doesn't exist");
            }

            // If there are no child nodes or content, then this is a shell - don't do anything yet
            if (!post[0].childNodes || post[0].childNodes.length==0 || !post.innerText()) {
                return cuz('it is still being downloaded', 'notyet');
            }
            // On permalink pages, don't filter until we've decided if this post is named in the link
            if (FX.context.type == 'permalink' && !post.hasClass('sfx_mr_checked')) {
                return cuz('it is not yet checked for permalink status', 'notyet');
            }
            // Filtering before inserted into All Posts & Filtered Feed can cause wrong tab residency
            if (!post.hasClass('sfx_filter_tab_0')) {
                return cuz('it is not yet added to initial tabs', 'notyet');
            }

            // Special handling for SFx Support Groups
            // 1. Posts in News or Groups Feed -- add 'sfx_support_post' class
            //    for possible styling (previously used to hide Reply links)
            if (FX.context.type != 'groups' || FX.context.id == 'feed') {
                var group_hovercard = post.find(group_link_selector).last();
                var group_href = group_hovercard.attr('href') || '';
                var group_linkname = group_href.replace(/.*\/groups\/([^/]*).*/,'$1');
                if (FX.sfx_support_groups.includes(group_linkname))
                    post.addClass('sfx_support_post');
            }
            // 2. Posts within a Support Group -- add 'sfx_support_post' class
            //    and disable filtering.  Filtering intentionally not blocked on
            //    News or Groups Feed, as notifications will still get through.
            if (FX.context.type == 'groups' && FX.sfx_support_groups.includes(FX.context.id)) {
                post.addClass('sfx_support_post');
                if (FX.option('filters_enabled_groups') && !FX.option('support_groups_allow_filters')) {
                    context_message('filter_disabled_in_support_message', FX.oneLineLtrim(`
                        Social Fixer automatically disables filtering in its<br>
                        Support Groups because the problem you're trying to<br>
                        solve might hide the solution you're looking for.`),
                        { title: 'Post Filtering Disabled' });
                    return cuz('filtering is automatically disabled in Social Fixer Support Groups');
                }
            }

            if (!FX.option('filters_enabled')) {
                return cuz('<b>Options &gt; Filters &gt; Post Filtering</b> is OFF');
            }

            if (!filters || !filters.length) {
                return cuz('there are no filters');
            }

            // Don't filter on timelines (including Pages) if that's disabled
            if (FX.context.type == "profile" && !FX.option('filters_enabled_pages')) {
                show_filtering_disabled_message();
                return cuz('<b>Options &gt; Filters &gt; Filter on Pages/Timelines</b> is OFF');
            }

            // Don't filter in Groups if that's disabled
            if (FX.context.type == "groups" && !FX.option('filters_enabled_groups')) {
                show_filtering_disabled_message();
                return cuz('<b>Options &gt; Filters &gt; Filter in Groups</b> is OFF');
            }

            filter_trace(dom_id, 'decide_filter_post() says to filter');
            return true;
        };

        const filtering_complete = function (post) {
            post.attr('sfx_filtered','true');
            X.publish('post/filtered', { $post: post, });
        };

        const decide_filter_post = function (post, dom_id, tries_left) {
            const decision = decide_filter_post_internal(post, dom_id);
            if (decision == true) {
                return true;
            }
            if (decision == 'notyet') {
                return tries_left > 0 ? 'notyet' : 'forced';
            }
            if (decision == false && !post.attr('sfx_filtered')) {
                filter_trace(dom_id, 'Not filtering because decide_filter_post() says not to');
                // Some static don't-filter condition: mark already filtered
                filtering_complete(post);
            }
            // decision == false or 'already': don't filter
            return false;
        };

        var filter_post = function (msg, data, tries_left) {
            if (typeof tries_left === 'undefined') {
                tries_left = 5; // XXX arbitrary, revisit
            }
            const post = data.$post;
            var dom_id = data.id;
            var sfx_id = data.sfx_id;

            var post_data = sfx_post_data[dom_id] = {sfx_id, dom_id, id: dom_id, next_filter: 0};

            const proceed = decide_filter_post(post, dom_id, tries_left);
            if (proceed == false) {
                return false;
            }

            // FILTER THE POST!
            // ================
            const result =
                  (proceed == 'notyet') ? undefined
                : (proceed == 'forced') ? apply_filters(post, post_data, filters, true)
                /* proceed ==  true  */ : apply_filters(post, post_data, filters, false);
            if (result !== undefined) {
                // Filtering is complete, whether or not anything happened
                filtering_complete(post);
            } else {
                // Couldn't apply filters; try again after a delay
                filter_trace(dom_id, 'apply_filters() says to try again later');
                setTimeout(function() {
                    filter_trace(dom_id, 'filter_post() ready to try again');
                    if (post.attr('sfx_filtered')) {
                        filter_trace(dom_id, 'Nevermind, it got sfx_filtered in the meantime');
                        return;
                    }
                    filter_post(msg, data, tries_left - 1);
                },FORCED_PROCESSING_DELAY);
            }
        };

        // Filter all posts so [sfx_filtered] attribute is universal;
        // and to allow on-the-fly enabling
        X.subscribe_backlog('post/add', filter_post);

      });
    };
    X.subscribe_backlog('context/ready', init_post_filters);

    // This is an X().filter( function ): receives a DOM element as 'this'
    var filter_out_comments = function() {
        return !X(this).is('[sfx_post] [role=article] *');
    };

    const found_gns = {
        P: { count: 0, msg: 'page-wide group insignia' },
        A: { count: 0, msg: 'group self-link aria-label' },
        T: { count: 0, msg: 'group name text in post' },
    };

    function found_gn(method, id, group_name) {
        if (group_name) {
            found_gns[method].count++;
            X.support_note('group name methods', Object.entries(found_gns).map(e => e[0] + ':' + e[1].count).join(', '));
            filter_trace(id, `Group name '${group_name}' found by ${found_gns[method].msg}`);
        }
        return group_name || null;
    }

    const gn_selector_1 = [
        "[role=main] h1 a.S2F_font_700[href*='/groups/']:not([href*='/user/'])",
        "[role=main] h2 a.S2F_font_700[href*='/groups/']:not([href*='/user/'])",
    ].join(',');
    const gn_selector_2 = [
        "a.S2F_col_tx1[aria-label][href*='/groups/']:not([href*='/user/'])",
    ].join(',');
    const gn_rejector_2 = [
        '.S2F_bb_1pxdiv', // divider indicates an embedded post 'shared' by the main post
    ].join(',');
    const gn_selector_3 = [
        "h3 a.S2F_col_tx1.S2F_font_600[href*='/groups/']:not([href*='/user/'])",
        "h4 a.S2F_col_tx1.S2F_font_600[href*='/groups/']:not([href*='/user/'])",
    ].join(',');

    const found_aus = {
        S: { count: 0, msg: 'group post author string' },
        H: { count: 0, msg: 'H4 header element' },
        A: { count: 0, msg: 'group post author profile pic aria-label' },
     };

    function found_au(method, id, author_name) {
        if (author_name) {
            found_aus[method].count++;
            X.support_note('author name methods', Object.entries(found_aus).map(e => e[0] + ':' + e[1].count).join(', '));
            filter_trace(id, `Author name '${author_name}' found by ${found_aus[method].msg}`);
        }
        return author_name || null;
    }

    const au_selector_1 = [
        "a[href*='/groups/'][href*='/user/']:not([aria-label]) b",
        "b a[href*='/groups/'][href*='/user/']:not([aria-label])",
        "a[href*='/groups/'][href*='/user/']:not([aria-label]) strong",
        "strong a[href*='/groups/'][href*='/user/']:not([aria-label])",
        "a[href*='/groups/'][href*='/user/']:not([aria-label]) .S2F_col_tx1.S2F_font_600",
    ].join(',');
    const au_selector_2 = [
        "h4 a:not([href*='/groups/']) b",
        "h4 a:not([href*='/groups/']) strong",
        "h2 a:not([href*='/groups/']) b",
        "h2 a:not([href*='/groups/']) strong",
        "h4 b a:not([href*='/groups/'])",
        "h4 strong a:not([href*='/groups/'])",
        "h2 b a:not([href*='/groups/'])",
        "h2 strong a:not([href*='/groups/'])",
    ].join(',');
    const au_selector_3 = [
        "a.S2F_col_tx1[aria-label][href*='/groups/'][href*='/user/']",
    ].join(',');

    const content_selector_1 = [
        '.S2F_font_400.S2F_col_tx1 > .S2F_mb_0.S2F_ow_bw',
    ].join(',');
    const content_selector_2 = [
        '[style*="text-align"]',
    ].join(',');

    const app_selector_1 = [
        "a[data-appname]",
    ].join(',');
    const app_selector_2 = [
        "a.S2F_col_tx2.S2F_font_400[href*='/games/']",
        ".S2F_ch1_none ~ a.S2F_col_tx2",
    ].join(',');

    // Extract parts of the post that can be filtered on
    // NOTE: If a part can't be found (so its match is undefined), set the value as null.
    // If it is found but has no value, then set the value as empty string
    var extract = {
        "author": function (o, data) {
            data.authorContent = [];
            data.author = null;
            // 1. Posts in Groups Feed have <b>Author Name</b>
            //    Must precede <h4>, which will pick up group names as authors
            data.author || o.find(au_selector_1).each(function() {
                if ((data.author = found_au('S', o[0].id, this.innerText))) {
                    // Store a reference to the author link itself
                    data.authorContent = [this];
                    return false;
                }
            });
            // 2. Posts in News Feed (and elsewhere?) have <h4>Author Name</h4>
            data.author || o.find(au_selector_2).each(function() {
                if ((data.author = found_au('H', o[0].id, this.innerText))) {
                    // Store a reference to the author link itself
                    data.authorContent = [this];
                    return false;
                }
            });
            // 3. Posts in Groups may also have a usable aria-label on the author's profile pic
            data.author || o.find(au_selector_3).each(function() {
                if ((data.author = found_au('A', o[0].id, this.getAttribute('aria-label')))) return false;
            });
            return data.author;
        },
        "group": function (o, data) {
            data.group = null;
            // 1. Group name from page surrounds, on group-specific pages
            //    XXX this should be cached, updated by a posts/reset subscription
            data.group || X(gn_selector_1).each(function() {
                if ((data.group = found_gn('P', o[0].id, this.innerText))) return false;
            });
            // 2. Most group posts have the group name embedded in an aria-label
            data.group || o.find(gn_selector_2).each(function() {
                if (!X(this).parents(gn_rejector_2).length &&
                    (data.group = found_gn('A', o[0].id, this.getAttribute('aria-label')))) return false;
            });
            // 3. Most group posts also have the group name in a readable text
            data.group || o.find(gn_selector_3).each(function() {
                if ((data.group = found_gn('T', o[0].id, this.innerText))) return false;
            });
            return data.group;
        },
        "page": function (o, data) {
            data.page = null;
            if (data.author === undefined) {
                extract_post_data(o, data, 'author');
            }
            if (data.authorContent && data.authorContent[0]) {
                const $header = X(data.authorContent[0].childNodes[0]).closest('h2,h4');
                $header.find('*').each(function() {
                    // This is ultra-horrible, but it works for the moment...
                    if (SFX.frefpath(this,/eac.*rop/,'children','props','children','props','entity','__typename') == 'Page') {
                        data.page = data.author;
                        return false;
                    }
                });
            }
            return data.page;
        },
        "link_url": function (post, data) {
            data.link_url = [];
            post.find('a[href*="facebook.com/l.php?u="]')
                .filter(filter_out_comments)
                .forEach(function(link) {
                    var dissect_url = X(link).attr('href').match(/facebook.com.l.php.u=([^&]*)/);
                    if (dissect_url && dissect_url.length > 1) {
                        SFX.pushy(data.link_url, decodeURIComponent(dissect_url[1]));
                    }
                });
            data.link_url.length || (data.link_url = null);
            return data.link_url;
        },
        "link_text": function (post, data) {
            data.link_text = [];
            post.find('a[href*="facebook.com/l.php?u="]')
                .filter(filter_out_comments)
                .forEach(function(link) {
                    SFX.pushy(data.link_text, X(link).text());
                });
            data.link_text.length || (data.link_text = null);
            return data.link_text;
        },
        "all_content": function (o, data) {
            var nodeFilter_obj = {
                acceptNode: function(node) {
                    if (node.nodeName == '#text') {
                        return NodeFilter.FILTER_ACCEPT; // Include this node's text
                    } else if (node.nodeType == node.ELEMENT_NODE &&
                         (node.tagName == 'FORM' ||                         // Skip the comment area
                           X(node).is('[sfx_post] [role=article]') ||       // Skip individual comments
                           getComputedStyle(node)['display'] == 'none')) {  // Skip 'Facebook Facebook' crap
                        return NodeFilter.FILTER_REJECT; // Skip node and don't visit its children
                    }
                    return NodeFilter.FILTER_SKIP;       // Skip node and *do* visit its children
                }
            };
            data.all_content = o.innerText(nodeFilter_obj) || extract_post_data(o, data, 'content') + ' [via ${content}]';
            return data.all_content;
        },
        "content": function (post, data) {
            // Store a reference to all userContent areas, in case we need to manipulate them (replace text, etc)
            data.userContent = [];
            data.content = [];
            let $content_els = post.find(content_selector_1);
            if (!$content_els.length) {
                $content_els = post.find(content_selector_2);
            }
            $content_els
                .filter(filter_out_comments)
                .forEach(function(el) {
                    data.userContent.push(el);
                    data.content.push(X(el).innerText());
                });
            data.content = data.content.join('\n');
            return data.content;
        },
        "action": function (o, data) {
            const postText = o[0].innerText || (o[0].lastChild && o[0].lastChild.innerText) || '';
            data.action = postText.replace(/[\n\u00b7].*/s,'');
            data.actionContent = [];
            if (data.action) {
                // Find the innermost element which contains the found text
                X(o[0].lastChild).find('*').each(function() {
                    const elemText = this.innerText || '';
                    if (elemText.length <= 2 * data.action.length) {
                        if (elemText.indexOf(data.action) == 0) {
                            // Store it as a reference to the action content
                            data.actionContent = [this];
                        } else if (data.actionContent) {
                            // 1st element *after* the action in traversal order
                            return false;
                        }
                    }
                });
            }
            return data.action;
        },
        "app": function (o, data) {
            data.app = null;
            var app;
            app || (app = o.find(app_selector_1).attr('data-appname'));
            app || o.find(app_selector_2).each(function() {
                return (!(app = this.innerText));
            });
            if (app) {
                data.app = app;
            }
            return data.app;
        },
        "image": function (post, data) {
            data.image = [];
            post.find('img[alt]')
                .filter(filter_out_comments)
                .forEach(function(img) {
                    SFX.pushy(data.image, X(img).attr('alt'));
                });
            data.image.length || (data.image = null);
            return data.image;
        },
        "hashtag": function (post, data) {
            data.hashtag = [];
            post.find("a[href*='/hashtag/']")
                .filter(filter_out_comments)
                .forEach(function(a) {
                    a.innerText[0] == '#' && SFX.pushy(data.hashtag, a.innerText.slice(1));
                });
            data.hashtag.length || (data.hashtag = null);
            return data.hashtag;
        },
    };
    SFX.port({ filter_extract_field: extract, }); // for mark_read.js
    SFX.pose({ filter_extract_field: extract, });

    // Util method to replace text content in text nodes
    function replaceText(rootNode, find, replace) {
        var children = rootNode.childNodes;
        for (var i = 0; i < children.length; i++) {
            var aChild = children[i];
            if (aChild.nodeType == 3) {
                var storedText = '';
                // If the parent node has an attribute storing the text value, check it to see if it's changed.
                // This is a method to prevent text replace actions from triggering another mutation event and repeatedly changing the same text.
                // This really only happens if the replace text is a superset of the find text.
                if (aChild.parentNode) {
                    storedText = aChild.parentNode.getAttribute('sfx_node_text') || '';
                }
                var nodeValue = aChild.nodeValue;
                if (nodeValue != storedText) {
                    var newVal = nodeValue.replace(find, replace);
                    if (newVal != nodeValue) {
                        aChild.nodeValue = newVal;
                        aChild.parentNode.setAttribute('sfx_node_text', newVal);
                    }
                }
            }
            else {
                replaceText(aChild, find, replace);
            }
        }
    }

    // Run filters to take actions on a post
    function apply_filters(post, data, filters, force_processing) {
        if (force_processing) {
            post.attr('sfx_filtered_forced', true);
        }
        if (!filters || filters.length == 0) {
            return false;
        }
        var match = false;
        filter_trace(data.id, `BEGIN Filtering (next_filter=${data.next_filter + 1})`);
        if (force_processing) {
            filter_trace(data.id, `Force filtering enabled`);
        }
        for (; data.next_filter < filters.length; data.next_filter++) {
            var filter = filters[data.next_filter];
            if (!X.isObject(filter)) {
                filter_trace(data.id, `Filter #${data.next_filter + 1} is empty, skipping`);
                continue;
            }
            if (filter.enabled === false) {
                filter_trace(data.id, `Filter #${data.next_filter + 1} (${filter.title}) Disabled`);
                continue;
            }
            const actor = `Filter #${data.next_filter + 1} (${filter.title})`;
            filter_trace(data.id, actor);
            var result = apply_filter(post, data, filter, actor, force_processing);
            if (typeof result=="undefined") { // Some rules could not be executed
                filter_trace(data.id, `END Filtering because a condition could not be tested yet.`);
                match = undefined;
                break;
            }
            if (result) {
                match = true;
                if (filter.stop_on_match) {
                    filter_trace(data.id, `Filter processing stopped because "Stop on Match" is active`);
                    break;
                }
            }
        }
        if (force_processing && match === undefined) {
            match = false;
        }
        if (match !== undefined) {
            filter_trace(data.id, `END Filtering. Filtered=${match}`);
        }
        return match;
    }

    // Extract one type of data from a post, to filter against
    function extract_post_data(post,extracted_data,type) {
        // If it's already been extracted in this run of filtering, return it
        if (typeof extracted_data[type]!="undefined") {
            return extracted_data[type];
        }
        if (typeof extract[type] != 'function') {
            return (extracted_data[type] = `\${${type}}`);
        }
        return extract[type](post, extracted_data);
    }

    // Execute a single filter on a post
    function apply_filter(post, data, filter, actor, force_processing) {
        if (!filter || !filter.rules || !filter.rules.length || !filter.actions) {
            return false;
        }
        var all_match = true;
        var any_match = false;
        var abort = false;
        // XXX Should be applied at input time so user sees the change
        // XXX May break legit pipe matchers: /foo\||bar/ or /bar|foo\|/
        // XXX Any other fun-yet-fixable mistakes users like to make?
        function fix_regexp_mistakes(regex_str) {
            return regex_str
                         .replace(/^\s*\|/,'')   // Leading pipe
                         .replace(/\|\|+/g,'|')  // Double (or more) pipes
                         .replace(/\|\s*$/,'')   // Trailing pipe
            ;
        }
        filter.rules.forEach(function (rule) {
            if (abort || !X.isObject(rule) || !rule.condition) {
                return;
            }
            var condition_text, regex, results;
            var regex_str, modifier;
            try {
                if (any_match && "ANY" === filter.match) {
                    return; // Already matched a condition
                }
                if (!all_match && "ALL" === filter.match) {
                    return; // Already failed on one rule, don't continue
                }
                var match = false;
                var operator = rule.operator;
                // Old style 'not_matches' operators were converted in options.js
                // (Old style operators in socialfixerdata/filters.json not handled;
                // they were only used in ancient, defunct Sponsored filters)
                const not = rule.not;
                const NOT = not ? 'NOT ' : '';

                // The "selector" rule isn't text-based, special case to handle first
                if ("contains_selector" == operator) {
                    const dequote = str => str.replace(/^(["'`])(.*)\1$/,'$2');
                    filter_trace(data.id, ` -> Looking for ${NOT}selector: ${rule.condition.text}`);
                    var contains = null;
                    var vcontains = null;
                    var hid_within = null;
                    var condition = rule.condition.text.
                        replace(/:contains\((.+?)\)\s*$/, function(_, m) {
                            contains = dequote(m);
                            return '';
                        }).
                        replace(/:has-visible-text\((.+?)\)\s*$/, function(_, m) {
                            vcontains = dequote(m);
                            return '';
                        }).
                        replace(/:hidden-within\((.+?)\)\s*$/, function(_, m) {
                            hid_within = dequote(m) + ' *';
                            return '';
                        });
                    var found = false;
                    var selector_matches = [];
                    try {
                        selector_matches = post.find(condition).filter(filter_out_comments);
                    } catch(e) {
                        filter_trace(data.id, ' -----> Selector lookup failed:');
                        filter_trace(data.id, ' -----> ' + e);
                    }

                    if (selector_matches.length > 0) {
                        if (contains || vcontains) {
                            regex = new RegExp(contains || vcontains);
                            selector_matches.each(function() {
                                results = (contains ? X(this).innerText() : X.getNodeVisibleText(this)).match(regex);
                                if (results) {
                                    found = true;
                                    filter_trace(data.id, " ---> Matched Text: '" + RegExp.lastMatch + "'");
                                }
                                data.regex_match = results;
                                return !found;  // stop .each() when found
                            });
                        } else if (hid_within) {
                            selector_matches.each(function() {
                                X(this).parents(hid_within).each(function() {
                                    // Should this check for anything else -- font size 0, etc.?
                                    if (X(this).css('display') == 'none') {
                                        found = true;
                                    }
                                    return !found;  // stop inner .each() when found
                                });
                                return !found;  // stop outer .each() when found
                            });
                            filter_trace(data.id, ` ---> ${found ? '':'not'} found hidden within`);
                        } else {
                            found = true;
                        }
                    }

                    if ( (found && !not) || (!found && not) ) {
                        match = true;
                    }
                    filter_trace(data.id, ` ---> ${match ? 'match!' : 'no match'}`);
                }
                else if ("day"==rule.target) {
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    var dayList = dayNames.filter((name, dow) => rule.condition['day_' + dow]).join(', ');
                    filter_trace(data.id, ` -> Looking for day(s) of week: ${dayList}`);
                    var dow = (new Date()).getDay();
                    if (rule.condition["day_"+dow]) {
                        match = true;
                    }
                    filter_trace(data.id, ` ---> Day of week is ${dayNames[dow]} - ${match ? 'match!' : 'no match'}`);
                }
                else if ("age"==rule.target) {
                    //var post_time = extract_post_data(post, data, 'post_time');
                    filter_trace(data.id, ` -> Looking for post age ${rule.operator} ${rule.condition.value} ${rule.condition.units == 'h' ? 'hours' : 'days'}`);
                    var post_time = (post.find('abbr[data-utime]').first().attr('data-utime') || 0) * X.seconds;
                    if (post_time) {
                        var check = rule.condition.value;
                        if (rule.condition.units=='h') { check *= X.hours; }
                        if (rule.condition.units=='d') { check *= X.days; }
                        var age = X.now() - post_time;
                        if (rule.operator=="gt" && (age>check)) {
                            match = true;
                        }
                        else if (rule.operator=="lt" && (age<check)) {
                            match = true;
                        }
                        filter_trace(data.id, ` ---> Post age is ${age}ms and must be ${rule.operator} ${check}ms - ${match ? 'match!' : 'no match'}`);
                    } else {
                        filter_trace(data.id, ` ---> Can't detect post time stamp - no match`);
                    }
                }
                // The rest are content selector rules
                else {
                    // If the regex has a leading or trailing | it will match everything - prevent that
                    condition_text = (rule.matcher == 'str')
                        ? `(${regexp_escape_literal(rule.condition.text)})`
                        : fix_regexp_mistakes(rule.condition.text);
                    var target = "";
                    if (rule.target == 'any' || rule.target == 'any+image') {
                        target = extract_post_data(post, data, 'all_content');
                        if (rule.target == 'any+image') {
                            var caption = extract_post_data(post, data, 'image');
                            target = [target, caption].flat().join(' ');
                        }
                    }
                    else {
                        target = extract_post_data(post, data, rule.target);
                    }
                    if (typeof target=="undefined") {
                        if (force_processing) {
                            // Act like target's empty so /^$/ matches successfully
                            filter_trace(data.id, ` ---> Rule target doesn't exist in post: ${rule.target}; no match`);
                            target = null;
                        }
                        else {
                            filter_trace(data.id, ` -----> Rule target doesn't exist (yet): ${rule.target}; defer filtering until later`);
                            abort = true;
                            return;
                        }
                    }
                    regex_str = null;
                    modifier = (rule.condition.modifier || '').replace(/I/,'') || 'i';
                    if (target == null) {
                        filter_trace(data.id, ` -----> Rule target ${rule.target} is null: not trying to match`);
                        match = false;
                    } else if ('equals' == operator) {
                        regex_str = '^(?:' + condition_text + ')$';
                    } else if ('contains' == operator && rule.match_partial_words) {
                        regex_str = condition_text;
                    } else if ('contains' == operator) {
                        regex_str = '(?:^|\\b|\\W)(?:' + condition_text + ')(?:\\W|\\b|$)';
                    } else if ('startswith' == operator) {
                        regex_str = '^(?:' + condition_text + ')';
                    } else if ('endswith' == operator) {
                        regex_str = '(?:' + condition_text + ')$';
                    } else if ('matches' == operator) {
                        regex_str = condition_text;
                        modifier = (rule.condition.modifier || '').replace(/I/,'') || '';
                    } else {
                        filter_trace(data.id, ` -----> Rule operator '${rule.operator}' is invalid: no match`);
                        match = false;
                    }
                    if (regex_str !== null) {
                        regex = new RegExp(regex_str, modifier);
                        filter_trace(data.id, ` -> Testing ${NOT}\${${rule.target}}.match(${regex.toString()})`);
                        if (Array.isArray(target)) {
                            target.every(str => (results = regex.exec(str)) == null);
                        } else {
                            results = regex.exec(target);
                        }
                        if (not) {
                            match = (results == null);
                            filter_trace(data.id, match ? ' ---> NOT present (match succeeds)' :
                                                          ` ---> Found Text: '${RegExp.lastMatch}' (match fails)`);
                        } else {
                            match = (results != null);
                            filter_trace(data.id, match ? ` ---> Matched Text: '${RegExp.lastMatch}'` :
                                                          ' ---> no match');
                        }
                        data.regex_match = results;
                    }
                }
                if (match) {
                    any_match = true;
                }
                else if (all_match) {
                    all_match = false;
                }
            } catch (e) {
                filter_trace(data.id, " -----> ERROR: " + e.message);
            }
        });

        if (abort) {
            return; // undefined
        }

        // Were enough rules satisfied to execute the actions?
        if (!any_match || (filter.match == "ALL" && !all_match)) {
            return false;
        }

        // Filter matched! Execute the actions
        filter.actions.forEach(function (action) {
            apply_action(post, data, action, filter, actor);
        });

        // Filter matched
        return true;
    }

// Apply a single filter action to a post
    function apply_action(post, data, action, filter, actor) {
        const ACTION = '==:ACTION:==';
        var css_target;
        if (!X.isObject(action)) {
            filter_trace(data.id, `${ACTION} action is empty, doing nothing`);
        }
        else if ("class" == action.action) {
            css_target = action.selector ? post.find(action.selector) : post;
            filter_trace(data.id, `${ACTION} applying CSS class '${action.content}'`);
            css_target.addClass(action.content);
        }
        else if ("css" == action.action) {
            css_target = action.selector ? post.find(action.selector) : post;
            var rules = (action.content || '').split(/\s*;\s*/);
            filter_trace(data.id, `${ACTION} applying CSS '${action.content}'`);
            rules.forEach(function (rule) {
                var parts = rule.split(/\s*:\s*/);
                if (parts && parts.length > 1) {
                    css_target.css(parts[0], parts[1]);
                }
            });
        }
        else if ("replace" == action.action) {
            filter_trace(data.id, `${ACTION} replacing '${action.find}' with '${action.replace}'`);
            const replace_regex = new RegExp(action.find, 'gi');
            ['author','action','content','all_content'].forEach(field =>
                extract_post_data(post, data, field) &&
                    (data[field] = data[field].replace(replace_regex, action.replace)));
            data.authorContent.concat(data.actionContent).concat(data.userContent).forEach(content =>
                replaceText(content, replace_regex, action.replace));
        }
        else if ("hide" == action.action) {
            if (never_hide(post)) { return; }
            if (!post.hasClass('sfx_filter_hidden')) {
                post.addClass("sfx_filter_hidden");
                // Control actual visibility of the post, and adjust tab 'Hide' counts
                X.publish('post/hide_filt', { $post: post, actor, });
                filter_trace(data.id, `${ACTION} hiding post`);
                add_filter_hidden_note(filter, action, post, data);
            } else {
                filter_trace(data.id, `${ACTION} would have hidden post (was already hidden)`);
            }
        }
        else if ("unhide" == action.action) {
            if (post.hasClass('sfx_filter_hidden')) {
                post.find('.sfx_filter_hidden_note').remove();
                post.removeClass("sfx_filter_hidden");
                // Control actual visibility of the post, and adjust tab 'Hide' counts
                X.publish('post/unhide_filt', { $post: post, actor, });
                filter_trace(data.id, `${ACTION} unhiding post`);
            } else {
                filter_trace(data.id, `${ACTION} would have unhidden post (was not hidden)`);
            }
        }
        else if ("read" == action.action) {
            if (!post.hasClass('sfx_post_read')) {
                // Save that post is now 'Read', adjust visibility & tab 'Read' counts
                X.publish('post/mark_read', { post, sfx_id: data.sfx_id, save: true, filter: true, actor, });
                filter_trace(data.id, `${ACTION} marking post 'Read'`);
            } else {
                filter_trace(data.id, `${ACTION} would have marked post 'Read' (was already 'Read')`);
            }
        }
        else if ("unread" == action.action) {
            if (post.hasClass('sfx_post_read')) {
                // Save that post is now 'Unread', adjust visibility & tab 'Read' counts
                X.publish('post/mark_unread', { post, sfx_id: data.sfx_id, save: true, filter: true, actor, });
                filter_trace(data.id, `${ACTION} unmarking post 'Read'`);
            } else {
                filter_trace(data.id, `${ACTION} would have unmarked post 'Read' (was not 'Read')`);
            }
        }
        else if ("move-to-tab" == action.action ||
                 "copy-to-tab" == action.action) {
            var tab_name = SFX.std_tabname(regex_replace_vars(action.tab, data.regex_match, post, data));
            filter_trace(data.id, `${ACTION} ${action.action} '${tab_name}'`);
            X.publish(`filter/tab/${action.action.slice(0,4)}`, { tab: tab_name, post, data, actor, });
        }
    }

    function regex_replace_vars(str, matches, post, data) {
        if (typeof str !== 'string') {
            return '';
        }
        return str.replace(/\$(\d+|\{[0-9A-Za-z_]+(?::[^{}]*)?\})/g, function(m) {
            const var_ref = /* { */ m.replace(/\${?([^}]+)}?/, '$1');
            var [param, max_len, joiner, colon] = var_ref.split(':');
            if (joiner == '' && colon == '') {
                // handles '${all:20::}' to generate 'match1:match2'
                // (but not more complex joiners containing ':', sorry)
                joiner = ':';
            }
            var ret_str = '';
            if (matches && matches[param] != undefined) {
                ret_str = matches[param];
            } else if (matches && param == 'any') {
                // first parenthetical expression which caught anything
                ret_str = matches.slice(1).find((str) => str);
            } else if (matches && param == 'all') {
                // all parenthetical expressions which caught anything, joined
                ret_str = matches.slice(1).join(joiner);
            } else {
                ret_str = extract_post_data(post, data, param);
                if (Array.isArray(ret_str)) {
                    ret_str = ret_str.join(',');
                }
            }
            ret_str = typeof ret_str === 'string' ? ret_str : '';
            if (Number.isInteger(Number(max_len))) {
                ret_str = ret_str.slice(0, max_len);
            }
            return ret_str;
        });
    }

    function never_hide($post) {
        if ($post.find('a[href*="/socialfixer/"]').length) {
            return true; // Never hide posts from Social Fixer!
        }
        return false;
    }

    const commit_atrocity = function(note) {
        // Starting around 2021-12-10, the DOM of the first post is getting
        // rewritten some time after initial load, deleting the note text &
        // moving the rest of the post structure inside the note, i.e.:
        //
        // <div role="article">
        //     <div class="sfx_filter_hidden_note">NOTE</div>
        //     <div rest-of-post>...</div>
        // </div>
        //
        // becomes:
        //
        // <div role="article">
        //     <div class="sfx_filter_hidden_note">
        //         <div rest-of-post>...</div>
        //     </div>
        // </div>
        //
        // Thus if the first post in the feed is one we try to hide, the post
        // isn't hidden, but gets framed in our 'post is hidden' decorations.
        //
        // Use a mutation observer to bludgeon this to death...
        const first_note_observer = new MutationObserver(function(records) {
            for (const record of records || []) {
                // Move the added child (entire post contents) back to the parent
                for (const add of record.addedNodes || []) {
                    add.nodeType != note.TEXT_NODE && note.parentNode.append(add);
                }
                // Dredge our removed child text node out and reattach it
                for (const rem of record.removedNodes || []) {
                    rem.nodeType == note.TEXT_NODE && note.append(rem);
                    X.support_note('hidden_note','2021-12 layout derangement bug handled');
                }
            }
            first_note_observer.disconnect();
        });
        first_note_observer.observe(note, { childList: true });
    };

    const add_filter_hidden_note = function(filter, action, post, data) {
        const is_permalink = post.hasClass('sfx_permalink_post');
        const is_popup = post.hasClass('sfx_popup_post');
        if (!action.show_note && !is_permalink && !is_popup) {
            return;
        }
        // If it's the target of a permalink or in a popup, force it initially visible
        if (is_permalink || is_popup) {
            filter_trace(data.id,
                      is_popup ? 'Post is in popup: make initially visible'
                : is_permalink ? 'Post named in permalink: make initially visible'
                               : 'What a surprise'
            );
            post.addClass('sfx_filter_hidden_show');
        }
        const tooltip =
            FX.option('disable_tooltips') ?
                                 ''
                    : is_popup ? ` title="It is visible here because it's in a comment viewing popup"`
                : is_permalink ? ` title="It is initially visible here because this page's address mentions it"`
                               : ' title="To remove these hidden-post notes, edit Hide Posts or per-filter settings"';
        const css = action.css ? ` style="${action.css}"` : '';
        const note_text = (action.custom_note
            ? regex_replace_vars(action.custom_note, data.regex_match, post, data)
            : `Post hidden by filter "${filter.title}"${reveal_str}`);
        const nyet_text = (action.custom_nyet
            ? regex_replace_vars(action.custom_nyet, data.regex_match, post, data)
            : `Post was hidden by filter "${filter.title}"${rehide_str}`);
        const $note = X(FX.oneLineLtrim(`
            <div class="sfx_filter_hidden_note"${css}${tooltip}>
                <span class="sfx_filter_hider_note">${note_text}</span>
                <span class="sfx_filter_hider_nyet">${nyet_text}</span>
            </div>
        `));
        $note.on('click', function () {
            post.toggleClass('sfx_filter_hidden_show');
        });
        if (post.attr('sfx_post') == 1) {
            commit_atrocity($note[0]);
        }
        post.prepend($note);
    };
    // Add actions to the post action tray
    X.publish('post/action/add', {"section": "filter", "label": "Edit Filters", "message": "menu/options", "data": {"section": "Filters"}});
    X.publish('post/action/add', {"section": "filter", "label": "Filter Debugger", "message": "post/action/filter/debug"});
    X.subscribe('post/action/filter/debug', function (msg, data) {
        function stringify_leaf(obj) {
            if (typeof obj === 'function') {
                return '"[function]"';
            }
            try {
                return JSON.stringify(obj, null, 3);
            } catch(err) {
                if (/circular/.test(err)) {
                    return '"[circular]"';
                } else {
                    return `"[ERR: ${err}]"`;
                }
            }
        }
        function stringify_obj(obj) {
            return '{\n    ' + Object.keys(obj)
             .filter(key => obj[key] !== undefined)
             .map(key => `"${key}":${stringify_leaf(obj[key])}`)
             .join(',\n    ') + '\n}';
        }
        const $post = X('#' + data.id);
        Object.keys(extract).forEach(field => extract_post_data($post, sfx_post_data[data.id], field));
        var data_content = stringify_obj(sfx_post_data[data.id], null, 3);
        data_content = data_content ? data_content.replace(/\n/g, '<br>') : 'No Data';
        var trace = sfx_filter_trace[data.id];
        var trace_content = 'No Trace';
        if (trace) {
            trace_content = trace.slice(1)
                .map(str => X.htmlEncode(str))
                .join('<br>')
                .replace(/&lt;b&gt;/g, '<b>')
                .replace(/&lt;\/b&gt;/g, '</b>')
            ;
        }
        var content = FX.oneLineLtrim(`
            <div>This popup gives details about how this post was processed for filtering.</div>
            <div class="sfx_bubble_note_subtitle">Filtering Trace</div>
            <div class="sfx_bubble_note_data">${trace_content}</div>
            <div class="sfx_bubble_note_subtitle">Raw Extracted Post Data</div>
            <div class="sfx_bubble_note_data">${data_content}</div>
        `);
        bubble_note(content, {"position": "top_right", "title": "Post Filtering Debug", "close": true});
    });
});

// =====================================
// Post Filter: Move/Copy To Tab
// =====================================
X.ready('post_tabs', function() {
    var tab_data = {};
    FX.add_option('always_show_tabs', {
        "section": "Advanced"
        , "title": "Always Show Tab List"
        , "description": "Always show the list of Tabs in the Control Panel, even if no posts have been moved to tabs yet."
        , "default": false
    });

    const visible_posts = tab => tab ? tab.post_count - tab.hide_count : 0;
    const normal_tab = name => name != 'All Posts' && name != '<Holding Tank>';
    const user_tab = name => normal_tab(name) && name != 'Filtered Feed';
    const select_first_occupied = (names, threshold) => names.find(name =>
        normal_tab(name) && visible_posts(tab_data.tabs[name]) >= threshold && (select_tab(tab_data.tabs[name]), true));

    // Post presence watcher:
    //
    // If we had posts loaded and then they disappeared, FB transitioned to
    // a different internal page.  Publish a 'posts/reset' signal so various
    // parts of SFx can reset.
    //
    // When the first post arrives on a newly reset page, try to decide which
    // post-tab to switch to.
    //
    // XXX This could dredge up a post which was hidden by something *else*,
    // like an ad blocker.  But hard to tell; getComputedStyle() won't help
    // since at the moment of evaluation *we* are potentially hiding the
    // post for not being in the current tab.
    var have_posts = false;
    const have_posts_watcher = function() {
        const have_posts_now = document.querySelector('[sfx_post]') != null;
        if (have_posts && !have_posts_now) {
            X.publish('posts/reset');  // FB cleared loaded posts
        }
        have_posts = have_posts_now;
        if (have_posts && tab_data.seek_initial) {         // Which tab should we start on?
            if (visible_posts(tab_data.selected_tab)) {        // The one we're already on?
                select_tab(tab_data.selected_tab);
            } else if (visible_posts(tab_data.tabs['Filtered Feed'])) {   // Filtered Feed?
                select_tab(tab_data.tabs['Filtered Feed']);
            } else {                                // First regular tab with visible posts
                select_first_occupied(tab_data.sorted(), 3);
            }
        }
    };
    const post_watcher_id = setInterval(have_posts_watcher, 0.5 * X.seconds);
    SFX.pose({ have_posts, have_posts_watcher, post_watcher_id, });

    const std_tabname = (name) => (typeof name == 'string' && name.length) ? name : '[nameless]';
    SFX.port({ std_tabname, }); // for post_filters.js

    // `always_show_tabs' means to show all static tab names at startup time;
    // otherwise, tabs are added when a post is first filtered to them.
    var tab_staticnames = [];
    const collect_static_tabs = function() {
        if (FX.option('filters_enabled') && FX.option('always_show_tabs')) {
            Object.values(FX.storage('filters') || []).forEach(filter =>
                X.isObject(filter) && filter.enabled && Object.values(filter.actions || []).forEach(action =>
                    X.isObject(action) &&
                    (action.action == "copy-to-tab" || action.action == "move-to-tab") &&
                    action.tab && !action.tab.match(/\$(\d+|\{[0-9a-z_:]+\})/) &&
                    SFX.pushy(tab_staticnames, std_tabname(action.tab))));
        }
    };
    collect_static_tabs();
    SFX.pose({ collect_static_tabs, tab_staticnames, });

    var tab_index, tabs_creating, tabs_created;
    const repopulate_tabs = function () {
        X('[class*=sfx_filter_tab_]').forEach(post => {
            post.classList.forEach(function(aClass) {
                if (/^sfx_filter_tab_(\d+)$/.test(aClass)) {
                    adj_counts(RegExp.$1, X(post), 1);
                }
            });
        });
    };
    SFX.pose({ repopulate_tabs, });
    const reset_tabs = function () {
        tab_data = {
            tab_count: 0, // tabs['name'].number counter
            tabs: {},     // .name        display name (and index within tabs{})
                          // .order       sorting name (a few are special and sort differently)
                          // .number      this tab's posts have CSS class 'sfx_filter_tab_%d'
                          // .selected    true if this is the selected tab
                          // .post_count  how many posts in this tab
                          // .read_count  how many of those are marked 'Read'
                          // .hide_count  how many are 'Read' or hidden by a filter
            selected_tab: null,   // points to the tab for which (tabs['name'].selected == true)
            seek_initial: true,   // have we figured out yet which tab to focus on?
            seek_permalink: true, // we'll refocus if a permalink post is received
            sorted: () => Object.keys(tab_data.tabs).sort((a, b) => (tab_data.tabs[a].order < tab_data.tabs[b].order) ? -1 : 1),
            cp_requested: false,  // Has tab creation asked to show the CP since this reset?
        };
        tab_index = [];   // maps tabs[tab_index[N]].number == N; tab_index[N] = tabs[tab_index[N]].name
        tabs_creating = false;
        tabs_created = false;
        have_posts = false;
        SFX.pose({ tab_data, tab_index, });
        if (FX.option('always_show_tabs')) {
            create_tab_container().then(() => X.publish('cp/always_show'));
        }
        repopulate_tabs();
    };

    const adj_counts = function (tabnum, $post, what) {
        const tab = tab_data.tabs[tab_index[tabnum]];
        if (!tab) {
            return X.support_note('adj_counts', `post ${$post[0].id} in unknown tab number ${tabnum}`);
        }

        // 'Read' & 'filtered' aren't tracked separately because then
        // 5 'Read' + 5 'filtered' in a tab could mean 5 posts which
        // are both -- or 5 of each.  We need to know how many are visible.
        //
        // A numeric 'what' means a new post: set both of its states.
        // 'R' and 'F' mean an existing post changed only one state.
        // Both can affect the 'hide' count, but only if not already hidden
        // for the other reason.  Only 'R' can change the 'Read' count.

        const is_read = $post[0].classList.contains('sfx_post_read');
        const is_filt = $post[0].classList.contains('sfx_filter_hidden');
        const num = /\d/.test(what);

        if (num)                         { tab.post_count += what; }
        if (num && is_read)              { tab.read_count += what; }
        if (num && (is_read || is_filt)) { tab.hide_count += what; }
        if (what == 'R')                 { tab.read_count += (is_read ? 1 : -1); }
        if (what == 'R' && !is_filt)     { tab.hide_count += (is_read ? 1 : -1); }
        if (what == 'F' && !is_read)     { tab.hide_count += (is_filt ? 1 : -1); }
    };

    // Update tab counts when a post is hidden/unhidden because user,
    // filter, or saved data change its 'Read' status
    X.subscribe(['post/hide_read', 'post/unhide_read'], function(msg, data) {
        const $post = data.$post;
        const is_read = (msg === 'post/hide_read');
        const message = `${is_read ? 'M' : 'Unm'}arked 'Read' by: ${data.actor}`;
        X.publish('log/postdata', { $post, message, });
        // If it's being marked 'Read' in a popup, keep it visible (with border / user styling)
        if (is_read && $post.hasClass('sfx_popup_post')) {
            X.publish('log/postdata', { $post, message: 'Keep visible since post is in comment viewer popup' });
            $post.addClass(' sfx_show_read');
        }
        $post[0].classList.forEach(function(aClass) {
            if (/^sfx_filter_tab_(\d+)$/.test(aClass)) {
                adj_counts(RegExp.$1, $post, 'R');
            }
        });
    });

    // Update tab counts when a post is hidden/unhidden because of filter action
    X.subscribe(['post/hide_filt', 'post/unhide_filt'], function(msg, data) {
        const message = `${msg == 'post/hide_filt' ? 'H' : 'Unh'}idden by: ${data.actor}`;
        X.publish('log/postdata', { $post: data.$post, message, });
        data.$post[0].classList.forEach(function(aClass) {
            if (/^sfx_filter_tab_(\d+)$/.test(aClass)) {
                adj_counts(RegExp.$1, data.$post, 'F');
            }
        });
    });

    const remove_from_tabs = function($post, opt = {}) {
        $post[0].classList.forEach(function(aClass) {
            // Don't remove from tab 0 'All Posts' unless specified
            if (/^sfx_filter_tab_(\d+)$/.test(aClass) && (Number(RegExp.$1) || opt.all_posts)) {
                adj_counts(RegExp.$1, $post, -1);
                $post.removeClass(aClass);
            }
        });
    };

    // Update tab counts when a post is removed from DOM by FB
    X.subscribe('post/remove_dom', function(msg, data) {
        X.publish('log/postdata', { $post: data.$post, message: 'Removed from DOM by FB', });
        remove_from_tabs(data.$post, { all_posts: true, });
    });

    // Move posts from <Holding Tank> to Filtered Feed if they didn't get moved elsewhere
    X.subscribe('post/filtered', function(msg, data) {
        if (data.$post.hasClass('sfx_filter_tab_1')) {
            data.$post.removeClass('sfx_filter_tab_1');
            adj_counts(1, data.$post, -1);
            add_to_tab('Filtered Feed', data.$post, 'Moved', 'end of filtering');
        }
        // Switch to the tab the first permalink post is filtered to
        if (tab_data.seek_permalink && data.$post.hasClass('sfx_permalink_post')) {
            tab_data.sorted().filter(name => normal_tab(name)).find(name => {
                if (data.$post.hasClass(`sfx_filter_tab_${tab_data.tabs[name].number}`)) {
                    tab_data.seek_permalink = false;
                    // We only need to switch if the proposed tab is not already selected;
                    // also don't need to switch if this post is already in the current tab.
                    // Without that test, we might needlessly switch between tabs in which
                    // this post resides, e.g. from a group-specific tab to 'Filtered Feed'.
                    if (name != tab_data.selected_tab.name &&
                        !data.$post.hasClass(`sfx_filter_tab_${tab_data.selected_tab.number}`)) {
                            select_tab(tab_data.tabs[name]);
                            X.publish('log/postdata', { $post: data.$post, message:
                                `Switched to tab '${name}' to expose this permalink post`, });
                    }
                    return true;
                }
            });
        }
    });

    SFX.selected_tab_selector = '';
    const select_tab = function(tab) {
        tab_data.seek_initial = false;
        if (tab_data.selected_tab != tab) {
            if (tab_data.selected_tab) {
                tab_data.selected_tab.selected = false;
            }
            tab_data.selected_tab = tab;
            tab.selected = true;
            SFX.selected_tab_selector = `.sfx_filter_tab_${tab.number}`;
            X.css(`[sfx_post]:not(.sfx_filter_tab_${tab.number}):not(.sfx_popup_post) { display: none; }`, 'sfx_filter_tabselect');
            X.publish('filter/tab/scroll_to_top');
        }
    };

    // 'Mark All Read - Next' moves circularly to next occupied tab (skipping All Posts & <Holding Tank>)
    X.subscribe("filter/tab/next", function (/* msg, data */) {
        const names = tab_data.sorted();
        const sdx = names.findIndex(name => tab_data.tabs[name].selected);
        select_first_occupied([...names.slice(sdx + 1), ...names.slice(0, sdx)], 1);
    });

    const create_tab_container_dom = function() {
        if (X.find(`.${SFX.instance} [id=sfx_cp_filter_tabs]`)) {
            return;
        }
        X.publish("cp/section/add", {
            "name": 'Filter Tabs <span class="sfx_count">(unread / total)</span>'
            , "id": "sfx_cp_filter_tabs"
            , "order": 50
            , "help": "The Filtered Feed shows the filtered view of the feed, with posts removed that have been moved to tabs.\n\nThe All Posts view shows every post in the feed, even if it has been filtered to a tab."
        });
        const html = FX.oneLineLtrim(`
            <div class="sfx_cp_tabs" style="max-height:60vh;overflow:auto;">
                <div v-for="tab in tabs | orderBy 'order'" v-if="tab.name!='<Holding Tank>'" class="sfx_filter_tab" v-bind:class="{'sfx_tab_selected':tab.selected,'sfx_tab_occupied':(tab.post_count>tab.read_count)}" @click="select_tab(tab)">
                    {{tab.name}}&#32;
                    <span class="sfx_count">
                        (
                        <span class="sfx_unread_count" v-if="tab.read_count>0">
                            {{tab.post_count-tab.read_count}}/
                        </span>
                        {{tab.post_count}})
                    </span>
                </div>
            </div>
        `);
        const methods = {
            select_tab,
        };
        // Wait until the section is added before adding the content
        X.when(`.${SFX.instance} [id=sfx_cp_filter_tabs]`, function() {
            // Tabs subsection might already exist
            if (!X.find(`.${SFX.instance} .sfx_cp_tabs`)) {
                    template(`.${SFX.instance} [id=sfx_cp_filter_tabs]`, html, tab_data, methods);
            }
        });
    };

    var pending_create, pending_resolve;

    const create_tab_container = async function() {
        if (!pending_create) {
            // We Promise to call 'resolve' later, which we stash in 'pending_resolve'
            pending_create = new Promise(resolve => (pending_resolve = resolve));
        }
        if (tabs_creating) {
            // All callers but the first just immediately get the Promise
            return pending_create;
        }
        tabs_creating = true;
        create_tab_container_dom();
        X.when(`.${SFX.instance} [id=sfx_cp_filter_tabs]`, function() {
            // the tab container has been created: create initial tabs
            create_tab('All Posts', 'a');
            create_tab('<Holding Tank>', 'b');
            select_tab(create_tab('Filtered Feed', 'c'));
            tab_data.seek_initial = true;
            tab_staticnames.forEach(name => create_tab(name));
            tabs_created = true;
            // and inform any who are waiting for the promised container
            pending_resolve && pending_resolve();
            tabs_creating = pending_create = pending_resolve = null;
        });
    };

    const create_tab = function(tabname, letter) {
        tabname = std_tabname(tabname);
        if (!tab_data.tabs[tabname]) {
            const number = tab_data.tab_count++;
            // Sort special tabs to the top
            const order = `${letter || 'z'}-${tabname}`;
            Vue.set(tab_data.tabs, tabname, { name: tabname, order, number, selected: false, post_count: 0, read_count: 0, hide_count: 0, });
            tab_index[number] = tabname;
            if (!tab_data.cp_requested && user_tab(tabname)) {
                tab_data.cp_requested = true;
                X.publish('cp/show');
            }
        }
        return tab_data.tabs[tabname];
    };

    const add_to_tab = function(tabname, $post, action, actor) {
        if (!tabs_created) {
            // Recursive call will be invoked when the container is created
            create_tab_container().then(() => add_to_tab(tabname, $post, action, actor));
            return;
        }
        const tab = create_tab(tabname);
        const tabClass = 'sfx_filter_tab_' + tab.number;
        if (!$post.hasClass(tabClass)) {
            $post.addClass(tabClass);
            adj_counts(tab.number, $post, 1);
            X.publish('log/postdata', { $post, message: `${action} to tab '${tabname}' by: ${actor}` });
        }
    };

    // Service for ourselves and others: scroll to first visible post in visible tab
    X.subscribe('filter/tab/scroll_to_top', function ( /* msg, data */ ) {
        X(SFX.selected_tab_selector).each(function( /* this */ ) {
            if (this.getBoundingClientRect().height) {
                this.scrollIntoView(true);
                setTimeout(() => window.scrollBy(0, -150), 0.2 * X.seconds);
                return false;
            }
        });
    });

    // When a post is filtered into a new tab, move it
    X.subscribe(["filter/tab/move", "filter/tab/copy"], function (msg, data) {
        var action = 'Copied';
        if (msg == "filter/tab/move") {
            remove_from_tabs(data.post);
            action = 'Moved';
        }
        add_to_tab(data.tab, data.post, action, data.actor);
    });

    // When a post is first added, it belongs to 'All Posts' and '<Holding Tank>'
    // Add to 'All Posts' last, as it controls when to start filtering
    X.subscribe_backlog('post/add', function (msg, data) {
        const $post = data.$post;
        add_to_tab('<Holding Tank>', $post, 'Added', 'initial post processing');
        add_to_tab('All Posts', $post, 'Added', 'initial post processing');
    });

    X.subscribe_backlog('posts/reset', reset_tabs);
    reset_tabs();
});

X.ready( 'post_font', function() {
    const post_font_opts = {};
    const post_text_selector = '[sfx_post] *';
    const comment_text_selector = '[sfx_post] ul *';
    FX.add_option('post_font_size_2', {
        section: 'General',
        title: 'Font: Post Font Size',
        description: 'Set a custom size (in pixels) for post text, including comments.',
        type: 'number',
        min: 5,
        default: '',
        live: post_font_set_css,
    });
    FX.add_option('post_font_family_2', {
        section: 'General',
        title: 'Font: Post Font Family',
        description: 'Set a custom font to be used for post text, including comments.',
        type: 'text',
        default: '',
        live: post_font_set_css,
    });
    FX.add_option('post_comment_font_size_2', {
        section: 'General',
        title: 'Font: Post Comment Font Size',
        description: 'Set a custom size (in pixels) for post comments only.',
        type: 'number',
        min: 5,
        default: '',
        live: post_font_set_css,
    });
    FX.add_option('post_comment_font_family_2', {
        section: 'General',
        title: 'Font: Post Comment Font Family',
        description: 'Set a custom font for post comments only.',
        type: 'text',
        default: '',
        live: post_font_set_css,
    });

    function post_font_set_css(val, opt) {
        post_font_opts[opt] = val;

        var css = [];
        +post_font_opts.post_font_size_2 >= 5 &&
            css.push(`${post_text_selector} { font-size: ${post_font_opts.post_font_size_2}px !important; }`);
        post_font_opts.post_font_family_2 &&
            css.push(`${post_text_selector} { font-family: "${post_font_opts.post_font_family_2}" !important; }`);
        +post_font_opts.post_comment_font_size_2 >= 5 &&
            css.push(`${comment_text_selector} { font-size: ${post_font_opts.post_comment_font_size_2}px !important; }`);
        post_font_opts.post_comment_font_family_2 &&
            css.push(`${comment_text_selector} { font-family: '${post_font_opts.post_comment_font_family_2}' !important; }`);
        X.css(css.join('\n'), 'sfx_post_font_css');
    }
});

X.ready('post_processor', async function() {
    const theater_mode_comments_selector = [
        '.S2F_fldr_col [role=main] ~ [role=complementary].S2F_bg_surf > .S2F_just_spbt',
    ].join(',');
    const new_post_selector = [
        '[role=article]:not(.S2F_pos_rel)',
        // News Feed posts with [aria-posinset]:
        '[aria-posinset]',
        // News Feed posts without [aria-posinset]:
        'div[aria-describedby].S2F_outl_none:not(.S2F_disp_infl):not(.S2F_zi_0):not(.S2F_pos_rel)',
        // 'Reels' permalink posts:
        'div.S2F_disp_flex.S2F_fldr_row.S2F_pos_rel.S2F_hei_100.S2F_alini_cent.S2F_just_cent',
        // 'Theater mode' comments:
        theater_mode_comments_selector,
    ].join(',');
    const popup_contained_post_selector = [
        '[class*="-mode"].S2F_pos_rel [aria-labelledby] *',
    ].join(',');
    const popup_post_container_selector = [
        '[aria-labelledby]',
    ].join(',');
    const new_post_verifier = 'a[aria-label]';
    const mkt_post_selector = [
        '[data-pagelet*=Marketplace] .S2F_disp_cont .S2F_vis_vis.S2F_flex_shr1.S2F_flex_0px[style*=width]',
        '.S2F_alinc_flst.S2F_fldr_row.S2F_just_flst.S2F_flex_wrap > .S2F_vis_vis.S2F_flex_shr1.S2F_flex_0px[style*=width]',
    ].join(',');
    const mkt_post_verifier = 'a[role=link]';
    const old_post_selector = '[sfx_post]';

    var pending_reset_check = true;
    var log = X.logger('post_processor');

    var sfx_post_id = 1;
    var max_posts = 10;
    var post_count = 0;

    FX.add_option('max_post_load_count', {
        section: 'Advanced',
        title: 'Post Auto-Loading',
        description: 'How many posts should be allowed to load before being paused.',
        type: 'text',
        default: max_posts,
        live: (val) => (max_posts = val || max_posts)
    });

    // When the page is first loaded, scan it for posts that exist as part of the static content
    // and also watch for new nodes to be installed
    FX.on_content_loaded(function () {
        // Notice and handle removed posts
        FX.on_content_removed(function ($dom) {
            $dom.probe('[sfx_post]:not(.sfx_removing)').forEach(post =>
                X.publish('post/remove_dom', { id: post.id, sfx_id: post.getAttribute('sfx_id'), $post: X(post).addClass('sfx_removing'), })
            );
        });
        // Find and handle inserted posts
        FX.on_content_inserted(function (o) {
            // If the inserted node lives within a <form> then it's in
            // the reaction part of the post, we don't need to re-process
            if (o.closest('form').length) {
                return;
            }
            find_and_process_posts(o);
        });
        // is there a race condition between startup of the above watcher, and this whole-doc scan?
        find_and_process_posts(X(document.body));
    });

    const do_reset_check = function() {
        if (pending_reset_check) {
            if (X(old_post_selector).length == 0) {
                post_count = 0;
                sfx_post_id = 1;
                X.pubsub_clear_backlog('post/add');
                X.pubsub_clear_backlog('posts/reset');
                X.publish('posts/reset');
            }
            pending_reset_check = false;
        }
    };

    var post_selector = new_post_selector, post_verifier = new_post_verifier;
    X.subscribe_backlog('context/ready', function() {
        if (FX.context.type == 'marketplace') {
            post_selector = mkt_post_selector;
            post_verifier = mkt_post_verifier;
        } else {
            post_selector = new_post_selector;
            post_verifier = new_post_verifier;
        }
        find_and_process_posts(X(document.body));
    });

    const sanity = function() {
        const $post = X(this);
        // Don't re-add posts we've already added!
        if ($post.is(old_post_selector)) {
            return false;
        }
        // If the post has an aria-posinset attribute, we know it's legit
        if ($post.attr('aria-posinset')) {
            return true;
        }
        // If it has a parent post, this is a comment or embedded article
        if ($post.parents('[sfx_post],[aria-posinset]').length) {
            return false;
        }
        // Don't let the empty 'loading' posts in the News Feed trick us
        if (!this.textContent && $post.find('[role=progressbar]').length) {
            return false;
        }
        // Reconfirm with page-type-specific verifier
        return !!this.querySelector(post_verifier);
    };

    // This allows us to get our bearings in the late-2022 / early-2023
    // 'new, degraded' post comments popup.  It might later be used for
    // other similar things.
    const find_post_root = function(post) {
        const $post = X(post);
        if ($post.is(popup_contained_post_selector)) {
            const $popup = $post.nearby(popup_post_container_selector);
            $popup.addClass('sfx_popup_post');
            return $popup[0];
        }
        return post;
    };

    // Find and identify posts within any DOM element
    // This is fired at document load, and any time content is inserted.
    const find_and_process_posts =
        container => container.probe(post_selector)     // X.fn.probe, returns Z
                              .filter(sanity)           // X.fn.filter, returns Z
                              .toArray()                // X.fn.toArray, returns Array
                              .map(find_post_root)      // Array.prototype.map, returns Array
                              .forEach(process_post);   // Array.prototype.forEach

    // Do the initial processing of a post and mark it as being seen by SFx
    async function process_post(post) {
        do_reset_check();
        const id = post.id || (post.id = 'sfx_post_' + sfx_post_id);
        post.setAttribute('sfx_post', sfx_post_id); // Mark this post as seen
        X.publish('log/postdata', {id, message: `processing post id=${id}, sfx_post=${sfx_post_id}`});
        // We store the post's unique FB object ID -- if available -- as its 'sfx_id'
        // Asynchronous; eventually triggers filtering etc.
        get_post_id(X(post), id).then(function(sfx_id) {
            post.setAttribute('sfx_id', sfx_id);
            X.publish('log/postdata', {id, message: 'Calling post/add'});
            X.publish('post/add', { id, selector: '#' + id, sfx_id, $post: X(post), });
        });
        sfx_post_id++;  // Global count during the current page load
        post_count++;   // Local count up to the user-set paging limit

        // If we have processed too many posts, pause here
        if (post_count >= max_posts) {
            pause_infinite_scroll();
        }
    }
    SFX.pose({ post_selector, post_verifier, find_and_process_posts, process_post, });

    // The pager on main (fb/search/top/?q=...) and post
    //                   (fb/search/posts/?q=...) search result pages
    const search_pager_selector = [
        '[role=feed] div.S2F_wid_1.S2F_hei_1:empty',
    ].join(',');

    const find_infinite_scroll_triggers = function() {
        // This algorithm finds the pager on News Feeds, and many
        // other page types.  When it works, it generally returns
        // 2 empty divs; hiding the 1st (or both) stops the feed.
        var $proposed = X('.suspended-feed').closest('.S2F_ovfa_n').parent().children(':empty');
        if (!$proposed.length) {
            // This algorithm finds the pager on main (fb/search/top/?q=...)
            // and post (fb/search/posts/?q=...) search result pages.
            $proposed = X(search_pager_selector).parent();
        }
        return $proposed;
    };

    const pause_infinite_scroll = function() {
        // Find the DIVs that trigger infinite scroll
        // Luckily it stops working if it's display:none
        var $infinite_scroll_triggers = find_infinite_scroll_triggers();
        log(`Max post count (${max_posts}) reached. Loaded ${post_count}. Trying to prevent infinite scroll.`);
        if (!$infinite_scroll_triggers.length) {
            // We don't know what to do here, so don't screw anything up. Exit nicely.
            log("Couldn't identify infinite scroll triggers definitively. Aborting.");
            return;
        }
        $infinite_scroll_triggers.addClass('sfx_scroll_pause');
        var pager = X(`[id=sfx-feed-pager].${SFX.instance}`);
        try {
            if (!pager.length) {
                pager = X(`<div id="sfx-feed-pager" class="sfx_info sfx-pager ${SFX.instance}" style="cursor:pointer;"><b>Infinite Scroll Prevented &ndash; Social Fixer ${SFX.version}</b><br>Social Fixer has paused automatic loading of more than ${max_posts} posts to prevent Facebook from going into an infinite loop. <b><u>Click this message</u></b> to continue loading about <input class="sfx_input" type="number" min="1" value="${max_posts}" style="width:7ch;" size="4" sfx-option="max_post_load_count"> more posts.<br></div>`);
                FX.attach_options(pager);
                pager.find('input').click(function () {
                    // Don't bubble up to pager
                    return false;
                });
                pager.click(function () {
                    pager.remove();
                    X('.sfx_scroll_pause').removeClass('sfx_scroll_pause');
                    post_count = 0;
                });
            }
            // Make sure the pager is at the end and visible
            X('.sfx_scroll_pause').last().after(pager);
        } catch (e) {
            alert(e);
        }
        // Hide shimmering 'posts loading' indicator while paused
        const feed_is_loading_selector = [
            '.suspended-feed ~ [role=article]',
        ].join(',');
        X(feed_is_loading_selector).addClass('sfx_scroll_pause');
    };
    SFX.pose({ find_infinite_scroll_triggers, pause_infinite_scroll, });

    // When navigating, check if we need to reset post count
    FX.on_page_unload(function () {
        pending_reset_check = true;
    });

    // Send FB-recognizable pointer events: they are ignored if the
    // screen & client coordinates are zero.  The sfx_event property
    // is for the benefit of mark_read.js.
    const FB_pointer_event = {
        bubbles: true,
        screenX:100, screenY:100,
        clientX:100, clientY:100,
    };
    function FB_pointerover(el) {
        // eslint-disable-next-line no-undef
        var event = new PointerEvent('pointerover', FB_pointer_event);
        event.sfx_event = true;
        el.dispatchEvent(event);
    }
    function FB_pointerout(el) {
        // eslint-disable-next-line no-undef
        var event = new PointerEvent('pointerout', FB_pointer_event);
        event.sfx_event = true;
        el.dispatchEvent(event);
    }

    const timestamp_selector = [
        'span[id] a.S2F_font_400[role=link][tabindex="0"]:not([href*="/user/"])',
        'span[id] a.S2F_col_tx2[role=link][tabindex="0"]:not([href*="/user/"])',
    ].join(',');
    const insights_selector = [
        'a[href*="/post_insights/"].S2F_alini_stre.S2F_bb_dark.S2F_fldr_row',
    ].join(',');
    const mediaset_selector = [
        'a.S2F_trans_n',             // : some ads, some media posts with no text
        '.S2F_alini_stre > a.S2F_disp_inlb', // : some profile pic changes
    ].join(',');
    const Alt = true;
    const found_ids = {
        // Marketplace Buy/sell item ID
            B: { count: 0, msg: 'found by marketplace Buy/sell item ID', selector: mkt_post_verifier,
                 test: () => (FX.context.type == 'marketplace'), Alt, },
        // Event IDs 'Person is interested in [event]'
            E: { count: 0, msg: 'found by event-ID', selector: 'a[href*="/events/"]:not([href*="/create/"])', Alt, },
        // Donation IDs 'Person is collecting donations for [donation]'
            D: { count: 0, msg: 'found by donate-ID', selector: 'a[href*="/donate/"]', Alt, },
        // 'Post insights' (seen by group admins) have embedded post IDs
            N: { count: 0, msg: 'found by post insights', selector: insights_selector, Alt, },
        // Comments on a post have embedded post IDs
            C: { count: 0, msg: 'found by comment link', selector: '[sfx_post] ul a[href*="comment_id="]:not([aria-hidden=true])', Alt, },
        // Media in some posts which otherwise have no IDs
            S: { count: 0, msg: 'found by mediaset-ID', selector: mediaset_selector, Alt, },
        // ID from page URL (permalink page)
            V: { count: 0, msg: 'found by page URL', },
        // URL extracted from JS structures
            U: { count: 0, msg: 'found by JS-URL', selector: 'a', },
        // ID extracted from JS structures
            I: { count: 0, msg: 'found by JS-ID-1', },
            J: { count: 0, msg: 'found by JS-ID-2', selector: '.S2F_oflx_hid.S2F_btl_rad0', },
            K: { count: 0, msg: 'found by JS-ID-3', },
        // Last gasp: mouse over the permalink to force it to be actualized
            M: { count: 0, msg: 'found by mouseover', selector: timestamp_selector, },
        // Mouseover failed due to no timestamp element
            T: { count: 0, msg: 'not found: no timestamp', fail: true, track: [], },
        // Mouseover failed due to no permalink in the timestamp element
            P: { count: 0, msg: 'not found: no permalink', fail: true, track: [], },
    };
    const id_mines = [
        { selector: '.S2F_bt_divid,.S2F_mb_6', path: 'edb,id', },
        { selector: 'div.S2F_flgr_1',          path: 'stI', },
        { selector: 'div.S2F_flgr_1',          path: 'tent', },
        { selector: 'div.S2F_flgr_1',          path: 'edb.*D', },
        { selector: 'div',                     path: 'dere,__id', },
        { selector: 'div',                     path: 'edb,id', },
        { selector: 'div',                     path: 'erS,edb.*D', },
        { selector: 'div',                     path: 'tor,t_i', }, // last: sometimes pulls up old post IDs
    ];

    function found_id(method, id, post_id) {
        if (!post_id || post_id === '0') {
            post_id = null;
        }
        if (post_id || found_ids[method].fail) {
            found_ids[method].fail ? found_ids[method].count-- : found_ids[method].count++;
            'track' in found_ids[method] && found_ids[method].track.push([id, X('#'+id), X('#'+id)[0].outerHTML]);
            X.support_note('post ID methods', Object.entries(found_ids).map(e => e[0] + ':' + e[1].count).join(', '));
            X.publish('log/postdata', {id, message: 'ID ' + found_ids[method].msg});
        }
        return post_id;
    }

    const get_coded_id = str => {
        if (Number(str)) return str;
        if (/(ZmVlZGJhY2[a-zA-Z0-9+/]*=*)/.test(str)) {
            str = atob(RegExp.$1);
            if (/dback:(\d+)/.test(str)) return RegExp.$1;
        }
    };

    const emb_id_eac = $post => {
        let ret;
        id_mines.some(({ selector, path }) => {
            $post.probe(selector).toArray().some(el => {
                id_mine = SFX.frefpath(el, 'eac.*ibe,etu,end.*rop', path);
                ret = get_coded_id(id_mine);
                return !!ret;
            });
            return !!ret;
        });
        return ret;
    };

    function emb_id($post, id, post_id) {
        if ((post_id = emb_id_eac($post)) && found_id('K', id, post_id)) {
            return post_id;
        }
        for (var a of Array.from($post.find(found_ids['J'].selector))) {
            const c = a.children[0];
            const fb_id = SFX.frefpath(c,'eac.*ibe,hil,hil,hil,pen.*ops,edb','id');
            try {
                post_id = atob(fb_id).replace(/\D*/,'');
                if (Number(post_id) && found_id('J', id, post_id)) {
                    return post_id;
                }
            } catch(e) { e; }
        }
        for (a of Array.from($post.find(found_ids['U'].selector))) {
            const o = SFX.fref(SFX.fref(a.parentElement, /eac.*ibe/).child, /end.*rop/);
            const U = SFX.fref(o, /tor.*rl$/);
            const I = SFX.fref(o, /^_*a+d.?id$/i);
            if ((post_id = (/www.facebook.com/.test(U) && found_id('U', id, extract_post_id_from_url(U)))) ||
                (post_id = /^\d{6,}(?:|:\d{1,2})$/.test(I) && found_id('I', id, `-${I}`))) {
                    return post_id;
            }
        }
        return null;
    }

    function url_id($post, id, post_id) {
        if ((post_id = extract_post_id_from_url(location.href)) && found_id('V', id, post_id)) {
            return post_id;
        }
        return null;
    }

    function alt_id($post, id, post_id) {
        // These are ordered in intentional precedence, best to worst
        // Don't combine to a single find() without implementing precedence...
        for (const [letter, method] of Object.entries(found_ids)) {
            if (method.Alt && (!method.test || method.test($post))) {
                for (var a of Array.from($post.find(method.selector))) {
                    if ((post_id = found_id(letter, id, extract_post_id_from_url(a.href)))) {
                        return post_id;
                    }
                }
            }
        }
        return null;
    }

    const possible_href = href => href && href !== '#' && href !== location.href + '#';

    async function get_post_id_internal($post, id) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async function(resolve) {
            var post_id = null;
            // Embedded data methods 1st, as they are fast and give the best IDs
            if ((post_id = emb_id($post, id, 0))) {
                return resolve(post_id);
            }
            // Direct examination of page URL 2nd, in case of a detectable permalink
            if ((post_id = url_id($post, id, 0))) {
                return resolve(post_id);
            }
            // Alternate URL methods 3rd, as they are cheap and consistent
            if ((post_id = alt_id($post, id, 0))) {
                return resolve(post_id);
            }
            // Timestamp scraping last, as it's slow and dangerous
            var timestamp;
            var did_mouseover = false;
            $post.addClass('sfx_touch');
            for (var tries = 0; tries < 40 && (timestamp || tries < 5); ++tries) {
                if (!timestamp) {
                    X.publish('log/postdata', {id, message: `Look for timestamp (${tries})`});
                }
                timestamp = $post.find(found_ids['M'].selector)[0];
                if (timestamp) {
                    var href = possible_href(timestamp.href) ? timestamp.href : timestamp.getAttribute('href');
                    if (possible_href(href)) {
                        X.publish('log/postdata', {id, message: `Found href '${href}' (${tries})`});
                        if ((post_id = found_id('M', id, extract_post_id_from_url(href)))) {
                            break;
                        }
                    }
                    if ([0,1,3,5,8,11,15,20,25,31,39].includes(tries)) {
                        // Trigger a hover over the timestamp on the post
                        // This will switch the href from '#' or stub URL to the real URL
                        did_mouseover = true;
                        FB_pointerover(timestamp);
                        const adverb = possible_href(href) ? 'better ' : '';
                        X.publish('log/postdata', {id, message: `Triggering mouseover to find ${adverb}href (${tries})`});
                        FB_pointerout(timestamp);
                    }
                }
                await X.sleep(0.2);
                // Try these again: they sometimes wake up after a while, and they're cheap
                if ((post_id = emb_id($post, id, 0))) {
                    break;
                }
            }
            if (did_mouseover) {
                FB_pointerout(timestamp);
                X.publish('log/postdata', {id, message: 'Triggering mouseout'});
            }
            setTimeout(() => $post.removeClass('sfx_touch'));
            if (!post_id) {
                found_id(timestamp ? 'P' : 'T', id, null);
            }
            resolve(post_id);
        });
    }

    // Extract the unique Facebook ID from a post / comment / reply link.
    // Returns null if no ID found.
    function extract_post_id_from_url(url) {
        // 2021-11-20: permalink IDs are long strings of digits, some with
        // 1-2 digits appended ':45' (a subsidiary ID).  Some places we
        // read IDs from embed those into a longer string of the form
        // 'digits:digits:...:ID', e.g. '1111:22222:333:12345:67', from
        // which we extract ID '12345:67'.  We then remove the ':digits'
        // part, which relates to some sub-post thing we don't attend to.
        //
        // These regular expressions are ordered to extract more reliable
        // patterns first, falling back to less safe ones when the better
        // ones fail.  The series is reliable for all current forms of
        // post timestamp permalinks, although there are forms found
        // elsewhere on FB which it may not handle.
        //
        // Uses the URL() constructor to decompose URLs into usable bits.

        const myURL = new URL(url, location.origin + location.pathname);

        let groupID = '';
        if (/\/groups\/(\d+)($|\/)/.test(myURL.pathname)) {
            groupID = RegExp.$1;
        }

        // URL forms that definitely aren't IDs
        if (
             // profile.php leads to a user profile, not a post
                /\/profile\.php/.test(myURL.pathname) ||
             // /groups/$GROUP/user/$ID: user's group resume, not a permalink
                /\/groups\/[^/]*\/user\//.test(myURL.pathname) ||
             // /donate/$ID/?.*fundraiser_source=feed: fundraiser ID, not a post ID
                (/\/donate\/[\d:]{6,}\/$/.test(myURL.pathname) && /fundraiser_source=feed/.test(myURL.search)) ||
           0) {
                return null;
        }

        // URL forms that might contain IDs in opaque encoded forms
        if (/[/?&=](pfbid0[1-9A-HJ-NP-Za-km-z]{20,75}l)\b/.test(myURL.href)) {
            // These base58-encoded forms first appeared in 2022 and we don't
            // yet know how to decode them to a proper FBID.  For now, use them
            // as opaque 'token' IDs.  See fb.com/5688526481166523 (please solve
            // the crypto puzzle!)
            return RegExp.$1;
        }

        if (/comment_id=((?:Y29|Q09|Q29)[A-Za-z0-9]{20,75}[=%3Dd]{0,12})(?:$|&)/.test(myURL.search)) {
            try {
                const decoded = atob(decodeURIComponent(RegExp.$1)).toLowerCase();
                // This will be in the format 'comment:123456_7890123', where
                // the numbers are postID_commentID.
                if (/comment:(\d{6,})[:_]/.test(decoded)) {
                    return RegExp.$1;
                }
            } catch(err) {
                // ignore, don't care, this just wasn't the way to get this post's ID
            }
        }

        // URL forms that might contain IDs
        if ((
             // /some/thing/{posts,permalink,video,stories,marketplace/item}/$ID[:digit][/] in path
                /\/(?:posts|permalink|video|stories|marketplace\/item)\/(\d{6,}(?:|:\d{1,2}))(?:$|\/)/.test(myURL.pathname) ||
             // /watch/?v=$ID
                (myURL.pathname == '/watch/' && /\bv=(\d{6,})/.test(myURL.search)) ||
             // ...permalink[=:]$ID[:digit], ...multi_permalinks[=:]$ID[:digit]; may be in search
                /permalinks?[=:](\d{6,}(?:|:\d{1,2}))(?:$|\D)/.test(myURL.href) ||
             // {fbid,post_id}[=:]$ID[:digit] anywhere in URL, including search & hash
                /(?:fbid|post_id)[=:](\d{6,}(?:|:\d{1,2}))(?:$|\D)/.test(myURL.href) ||
             // pcb.$ID[:digit] anywhere in URL, including search & hash
                /\Wpcb\.(\d{6,}(?:|:\d{1,2}))(?:$|\D)/.test(myURL.href) ||
             // /some/thing/$ID[:digit][/], /some/thing/whatever+digits:$ID[:digit][/]
                (/(?:\d:|\/)(\d{6,}(?:|:\d{1,2}))\/?$/.test(myURL.pathname) && RegExp.$1 != groupID) ||
             // ...[=:]$ID[:digit] ending any pathname component
                (/[=:/](\d{6,}(?:|:\d{1,2}))(?:$|\/)/.test(myURL.pathname) && RegExp.$1 != groupID) ||
             // ...[=:]$ID[:digit] anywhere in URL
                /[=:](\d{6,}(?:|:\d{1,2}))(?:$|\D)/.test(myURL.href) ||
             // set=[...]a.$ID in ?search args: master URLs of entire photo sets
                /set=[^&?/]*a\.(\d{6,}(?:|:\d{1,2}))/.test(myURL.search) ||
           0) && /^(\d+:?\d{0,2})$/.test(RegExp.$1)) {
                return RegExp.$1.replace(/:.*/,'');
        }
        return null;
    }

    async function get_post_id($post, id) {
        try {
            return get_post_id_internal($post, id).then(function(sfx_id) {
                sfx_id = (!sfx_id || sfx_id === '0') ? 'no-ID' : sfx_id.replace(/:.*/,'');
                if ((RegExp(`(^|\\D)${sfx_id}(\\D|$)`).test(decodeURIComponent(location.href))) ||
                    ($post.is(theater_mode_comments_selector))) {
                    X.publish('post/permalink', { $post, id, sfx_id, actor: 'post processor', });
                }
                X.publish('log/postdata', {id, message: 'get_post_id=' + sfx_id});
                return sfx_id;
            });
        } catch(e) {
            X.publish('log/postdata', {id, message: 'get_post_id failed: ' + e.toString()});
            return 'no-ID';
        }
    }
    SFX.pose({ extract_post_id_from_url, get_post_id, found_ids, });
});

X.ready('regex_tester', function() {
    X.subscribe("test/regex", function (msg, data) {
        var text = data.text || '';
        var modifier = data.modifier || '';
        var content = FX.oneLineLtrim(`
        <div draggable="false">Mozilla Developer Network: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions" target="_blank">Regular Expressions Documentation</a></div>
        <div draggable="false" class="sfx_label_value">
            <div>Expression: </div>
            <div><input id="sfx_regex_tester_expression" class="sfx_input" size="25" value="${text}"></div>
        </div>
        <div draggable="false" class="sfx_label_value">
            <div>Modifiers: </div>
            <div><input id="sfx_regex_tester_modifier" class="sfx_input" size="5" value="${modifier}"> [ g i m ]</div>
        </div>
        <div draggable="false"><b>Test String:</b><br>
            <textarea id="sfx_regex_tester_string" style="width:250px;height:75px;"></textarea>
        </div>
        <div draggable="false">
            <input type="button" class="sfx_button" value="Test" onclick="document.getElementById('sfx_regex_tester_results').innerHTML=document.getElementById('sfx_regex_tester_string').value.replace(new RegExp('('+document.getElementById('sfx_regex_tester_expression').value+')',document.getElementById('sfx_regex_tester_modifier').value),'<span style=&quot;background-color:cyan;font-weight:bold;&quot;>$1</span>');">        
        </div>
        <div draggable="false">
            <div><b>Results:</b></div>
            <div id="sfx_regex_tester_results" style="white-space:pre;"></div>
        </div>

    `);
        bubble_note(content, {"position": "top_right", "title": "Regular Expression Tester", "close": true});
    });
});

X.ready('sfx_collision', function () {
	// Don't run this if the page was loaded a long time ago:
	//
	// Firefox (and family?) seem to update already-installed web_extensions by
	// injecting the new script into the already running page where the old one
	// was previously injected.  Social Fixer sees that the page was previously
	// meddled with (by its own previous version!) -- but we need to ignore it.
	//
	// Collision check doesn't need to fire every time as long as it eventually
	// notifies the user on some later page load.
	//
	// Refs:
	//
	// https://www.w3.org/TR/navigation-timing/#sec-navigation-timing-interface
	// https://developer.mozilla.org/en-US/docs/Web/API/Performance/timing

	if (performance && performance.timing && performance.timing.domLoading) {
		if (X.now() - performance.timing.domLoading > 10 * X.seconds) {
			return;
		}
	}

	X.when(SFX.badge_sel, function () {
		// Allow all version(s) to finish init & fighting over badge
		setTimeout(function () {
			var collision_alert = function (ver_msg, advice) {
				alert(`\
WARNING: 2+ copies of Social Fixer are running!
- ${SFX.buildstr}
- ${ver_msg}
For best results, please run only one at a time!
=> Back up settings: http://tiny.cc/sfx-saveprefs
=> Remove extra copies: http://tiny.cc/sfx-only-1
=> Help/Support: https://socialfixer.com/support${advice ? '\n' + advice : ''}`);
				X.support_note('sfx_collision', `Other: '${ver_msg}'`);
			};

			var $badge = X(SFX.badge_sel);
			var old_buildstr = $badge.attr('old_buildstr');
			$badge.attr('old_buildstr', null);
			var badge_buildstr = $badge.attr('sfx_buildstr');

			// Don't complain about disabled other-versions, they're benign and
			// probably indicate someone doing some sort of complex testing...
			if (/\(disabled\)$/i.test(old_buildstr)) {
				return;
			}

			// Intentionally not an else-chain: intended & tested
			// to detect multiple classes of old version at once.

			// These divs existed in at least versions 5.968 through 12.0
			if (X("div.bfb_theme_extra_div").length > 0) {
				collision_alert("below 15.0.0",
				"\nNOTE: preferences from this version cannot be transferred, but should be saved for manual reference."
				);
			}
			// Another >=15 SFX without collision detection
			if (!badge_buildstr || old_buildstr == "old") {
				collision_alert("between 15.0.0 and 16.0.1");
			}
			// Another >=16 SFX with collision detection who created badge 1st
			// (if we created badge 1st, he complains for us)
			if (old_buildstr && old_buildstr != "old" && old_buildstr != SFX.buildstr) {
				collision_alert(old_buildstr);
			}
		}, 8 * X.seconds);
	});
});

FX.on_options_load(function () {
    X.storage.get('stats', {}, function (stats) {
        var today = X.today();
        if (today > (stats.last_ping || 0)) {
            stats.last_ping = today;
            X.ajax("https://SocialFixer.com/version.txt", function (/* ver, status */) {
                X.storage.set('stats', "last_ping", today);
            });
        }
    }, true);
});

FX.add_option('stay_on_page', {
    section: 'Experiments',
    title: 'Stay On Page',
    description: 'Prevent the browser from leaving the current Facebook page when you click on a link',
    default: false,
});

X.subscribe_backlog('context/ready', function() {
    FX.on_options_load(function () {
        // Exclude some pages where this interacts badly or is unhelpful
        if (FX.context.type == 'messages' || FX.context.id == 'settings') {
            return;
        }
        if (FX.option('stay_on_page')) {
            setTimeout(function() {
                X.inject(function() {
                    window.requireLazy(['Run'], function(Run) {
                        Run.onBeforeUnload(function() {
                            return 'Social Fixer: Stay On Page is protecting you from leaving this page before you intended to.  Choose whether you want to stay or leave.';
                        }, false);
                    });
                });
            }, 1.5 * X.seconds);
        }
    });
});

// ===================================================
// STICKY NOTES
// ===================================================
// note_parent = selector or DOM object to point to
// left_right = 'left' | 'right' where to put note (default: 'left')
// content = stuff in the note (string of text or HTML source)
// Previous 'close' functionality removed as nothing used it.
const sticky_note = function(note_parent, left_right, content) {
    left_right = (left_right == 'right') ? 'right' : 'left';
    var note = X(FX.oneLineLtrim(`
        <div class="sfx_sticky_note sfx_sticky_note_${left_right}" style="visibility:hidden">
            <div>${content}</div>
            <div class="sfx_sticky_note_arrow_border"></div>
            <div class="sfx_sticky_note_arrow"></div>
        </div>
    `)).appendTo(X(note_parent).first());
    return note.css({ marginTop: -(note[0].offsetHeight / 2) + 'px', visibility: 'visible', });
};

// Check to make sure that the extension's storage is working correctly
X.ready('storage_check', function() {
    X.task('storage_check', 1*X.days, function() {
        FX.on_options_load(function () { setTimeout(function() {
            var now = X.now();
            var success = null;
            var error = function (err) {
                success = false;
                // Oops, storage didn't work!
                var error_msg="";
                if (err) {
                    error_msg = "<br><br>Error: "+err;
                }
                const version_info = `<br><br>${SFX.user_agent}<br>Social Fixer ${SFX.buildstr}`;
                bubble_note("Social Fixer may have trouble saving your settings. If your settings won't stick, please let us know. See 'Support' under Options for contact info." + error_msg + version_info, {"close": true, "title": "Extension Storage Warning", "style": "width:300px;"});
                X.support_note('storage_check', err);
            };
            setTimeout(function () {
                if (success === null) {
                    error("Timeout waiting for storage response");
                }
            }, 8 * X.seconds);
            try {
                X.storage.set('storage_check', 'storage_checked_on', now, function () {
                    // Storage should have persisted by now
                    // Try retrieving it
                    try {
                        X.storage.get('storage_check', null, function (stats) {
                            if (!stats || !stats.storage_checked_on || (Math.abs(now - stats.storage_checked_on) > 60 * X.seconds)) {
                                var e = null;
                                if (!stats) { e="No stats"; }
                                else if (!stats.storage_checked_on) { e="stats.storage_checked_on doesn't exist"; }
                                else if ((Math.abs(now - stats.storage_checked_on) > 60 * X.seconds)) { e="stats.storage_checked_on = "+Math.abs(now - stats.storage_checked_on); }
                                return error(e);
                            }
                            success = true;
                        }, false);
                    } catch(e) {
                        error(e);
                    }
                });
            } catch(e) {
                error(e);
            }
        },1000);
        });
    });
});

// Are there any subscribed items at all?
const has_subscriptions = function (user_items) {
    return Object.values(user_items || []).some(item => X.isObject(item) && !!item.id);
};

// Tag each subscribable item with boolean .subscribed indicating whether
// user is subscribed to it
const mark_subscribed_items = function (subscriptions, user_items) {
    // Build up a list of user item id's
    var subscription_ids = {};
    Object.values(user_items || []).forEach(item =>
        X.isObject(item) && item.id && (subscription_ids[item.id] = true));
    Object.values(subscriptions || []).forEach(item =>
        X.isObject(item) && (item.subscribed = !!subscription_ids[item.id]));
};

// Retrieve the JSON list of subscribable items of this type; tag each
// item with boolean .subscribed indicating whether it was found in
// user_items; pass to callback
//
// `name' has three different uses, which for some callers are all the
// same; and for others are different.  To use the same name, pass a
// string; to use different names, pass an array containing:
//
//     [filename, fieldname, storagename]

const retrieve_item_subscriptions = function (name, user_items, callback) {
    if (typeof name === 'string') {
        name = [name, name, name];
    }
    const [filename, fieldname, storagename] = name;
    storagename !== storagename; // 'use' storagename

    X.ajax(`https://matt-kruse.github.io/socialfixerdata/${filename}.json`, function (content) {
        if (content && content[fieldname] && content[fieldname].length > 0) {
            // Mark the subscribed ones
            mark_subscribed_items(content[fieldname], user_items);
        }
        if (callback) {
            callback((content && content[fieldname]) ? content[fieldname] : null);
        }
    });
};

// Retrieve the JSON list of subscribable items of this type; update
// user's subscribed items with any changes found in the JSON (except
// .enabled, and a special case for customized filter actions).  If
// anything changed, write back to storage.
//
// `name' has three different uses, which for some callers are all the
// same; and for others are different.  To use the same name, pass a
// string; to use different names, pass an array containing:
//
//     [filename, fieldname, storagename]

const update_subscribed_items = function (name, user_items, callback, canonicalize) {
    retrieve_item_subscriptions(name, user_items, function (subscriptions) {
        if (!has_subscriptions(user_items)) {
            return callback ? callback(subscriptions, false) : null;
        }
        if (typeof name === 'string') {
            name = [name, name, name];
        }
        const [filename, fieldname, storagename] = name;
        var any_dirty = (filename !== filename); // false, and 'uses' filename
        // Loop through the subscriptions to see if user items need to be updated
        var subscribed = {};
        for (var key of Object.keys(user_items)) {
            var f = user_items[key];
            if (X.isObject(f) && f.id) {
                subscribed[f.id] = f;
            }
        }
        Object.values(subscriptions || []).forEach(function (item) {
            if (!X.isObject(item)) {
                return;
            }
            var user_item = subscribed[item.id];
            if (!user_item) {
                return;
            }
            if (typeof canonicalize === 'function') {
                canonicalize(item);
                canonicalize(user_item);
            }
            var key, dirty = false;
            // Map the properties of the subscription to the user item
            // Don't overwrite the entire object because things like 'enabled' are stored locally
            for (key in item) {
                if (key == "subscribed" || key == "enabled") {
                    continue;
                }
                // Check to see if the user item data needs updated
                // If user has customized actions, don't over-write, otherwise update
                if (fieldname == 'filters' && key == 'actions' &&
                    item.configurable_actions && user_item.custom_actions) {
                    continue;
                }
                if (fieldname == 'filters' && key == 'stop_on_match') {
                    continue;
                }
                if (!SFX.data_equals(user_item[key], item[key])) {
                    user_item[key] = item[key];
                    dirty = true;
                }
            }
            if (dirty) {
                user_item.subscription_last_updated_on = X.now();
                any_dirty = true;
            }
        });
        // if any of the subscriptions were dirty, save the items
        if (any_dirty) {
            X.storage.save(storagename, X.clone(user_items));
        }
        if (callback) {
            callback(subscriptions, any_dirty);
        }
    });
};
SFX.pose({ update_subscribed_items, });

X.ready('unread_filtered_messages', function() {
    const name = 'unread_filtered_messages';
    FX.add_option('check_unread_filtered_messages', {
        "title": "Check For Filtered Messages"
        , "description": "Facebook hides Messages from people outside your network and doesn't alert you. This feature alerts you if there are any unread messages that Facebook has filtered."
        , "default": true
    });
    FX.on_option('check_unread_filtered_messages', function () {
        X.subscribe_backlog('fb_dtsg/ready', function(msg, data) {
            const url = `https://mbasic.facebook.com/messages/?folder=other&fb_dtsg=${data.fb_dtsg}`;
            const ajax_strategies = [
                { ajax_func: SFX.ajax_cor, name: 'background script ajax', },
                { ajax_func: X.ajax, name: 'content script ajax', },
            ];
            // X.support_note() saves last note per key: this records success or last failure
            // for easy access, while also keeping the full log for more detailed examination
            let last_msg = 'starting up';
            const logger = X.logger(name);
            const log = msg => (logger(msg), X.support_note(name, msg), (last_msg = msg));
            // This calls itself recursively in what is effectively an async-chaining for loop
            const try_strat = function(idx) {
                const strat = ajax_strategies[idx];
                var count = 0, counted = false;
                strat.ajax_func && strat.ajax_func(url, function(ajax_result) {
                    if (typeof ajax_result !== 'string') {
                        log(`${strat.name}: non-string result ('${typeof ajax_result}')`);
                    } else if (ajax_result.length < 100) {
                        log(`${strat.name}: short result: '${ajax_result}'`);
                    } else if (!/<span/i.test(ajax_result)) {
                        log(`${strat.name}: result does not look like HTML`);
                    } else if (!/href.{1,40}messages\/\?folder/i.test(ajax_result)) {
                        log(`${strat.name}: result does not look like messages site`);
                    } else {
                        // Try to parse mbasic CSS & HTML directly
                        // Is the '.some_class { font-weight: bold; }' CSS still there?
                        var bold_matches = ajax_result.match(/\.([a-zA-Z0-9_]+)\s*{[^}]*font-weight[^:]*:{?[^};]*bold\s*;\s*{?}/);
                        if (bold_matches && bold_matches.length > 1) {
                            var bold_class = bold_matches[1];
                            // Filtered message subjects display as <h3 class="bb"> (normal) if 'read',
                            // class="ci" (bold) if 'unread'.  Count the '<h3 class="ci">' blocks.
                            // Except 'ci' is sometimes 'cj' or maybe something else?  So now we parse
                            // out the class, first.
                            bold_matches = ajax_result.match(RegExp(`<h3[^>]*class=.[^'"]*\\b${bold_class}\\b`, 'g'));
                            bold_matches && (count = bold_matches.length);
                            counted = true;
                            log(`succeeded by strategy '${strat.name} direct parsing'`);
                        } else {
                            log(`${strat.name}: class:bold CSS not found`);
                            try {
                                const $ajax_result = X(`<div>${ajax_result}</div>`);
                                X('body').append($ajax_result);
                                $ajax_result.find('h3 > a[href^="/messages"]').forEach(msg =>
                                    /[6-9]\d\d|[1-9]\d{3,}|bold/i.test(getComputedStyle(msg).fontWeight) && (count++));
                                $ajax_result.remove();
                                counted = true;
                                log(`succeeded by strategy '${strat.name} DOM injection'`);
                            } catch(e) {
                                log(`${strat.name}: DOM injection failed: '${e}'`);
                            }
                        }
                    }
                    // (counted && count == 0) is success, but don't want it in the badge menu!
                    if (count) {
                        const tooltip = FX.option('disable_tooltips') ? '' : ` title="Facebook Messenger hides chats from people they don't think you know. Social Fixer shows them here. To turn this off: disable Options > Check For Filtered Messages."`;
                        X.publish('menu/add', {section: 'actions', item: {html: `<span id='sfx_unread_jewel_count'></span><span${tooltip}>You have unread hidden Messages</span>`, url: '//m.facebook.com/messages/?folder=other', target: '_blank'}});
                        X.publish('notify/set', {
                            target: `.${SFX.instance} [id=sfx_unread_jewel_count]`,
                            parent_target: SFX.badge_sel,
                            count, });
                    }
                    if (!counted && ajax_strategies[++idx]) {
                        return try_strat(idx);
                    }
                    if (!counted && !ajax_strategies[idx]) {
                        const tooltip = FX.option('disable_tooltips') ? '' : ` title="${last_msg}"`;
                        X.publish('menu/add', {section: 'actions', item: {html: `<span${tooltip} class="sfx_unread_errmsg">Hidden msg check failed</span>`, url: '//m.facebook.com/messages/?folder=other', target: '_blank'}});
                    }
                });
            };
            try_strat(0);
        });
    });
});

// This actually executes module code by firing X.ready()
var run_modules = function() {
	// This tells each module to run itself
	X.ready();
	// First add any CSS that has been built up
	FX.css_dump();
	// Queue or Fire the DOMContentLoaded functions
	FX.fire_content_loaded();
};

// Should we even run at all? (see target_header.js)
if (!prevent_running) {
	// Allow modules to delay early execution of modules (until prefs are loaded) by returning false from beforeReady()
	if (X.beforeReady()!==false) {
		run_modules();
	}

  // Load Options (async)
  var bootstrap = function() {
    X.storage.get(['options', 'filters', 'tweaks', 'hiddens', 'postdata', 'friends', 'stats', 'tasks', 'messages'], [{}, [], [], {}, {}, {}, {}, {}, {}], function (options,err) {
      if (err) {
        console.log("Social Fixer Preferences could not be loaded from storage.");
        console.log(err);
      }
      else if (X.beforeReady(options) !== false) {
        run_modules();
        FX.options_loaded(options);
      }
    });
  };

  // Find out who we are
	// ===================
  X.userid = X.cookie.get('c_user') || "anonymous";
  // Prefix stored pref keys with userid so multiple FB users in the same browser can have separate prefs
  X.storage.prefix = X.userid;
  bootstrap();

}

} catch(e) {
    console.log(e);
}
