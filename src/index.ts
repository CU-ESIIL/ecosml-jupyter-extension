import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';
// import { Menu } from '@lumino/widgets';
import { IMainMenu } from '@jupyterlab/mainmenu';
import {PageConfig} from "@jupyterlab/coreutils";
import { ILauncher } from '@jupyterlab/launcher';
// import { INotification } from "jupyterlab_toastify";

import {IFrameWidget} from "./widgets";
import {request, RequestResult} from "./request";
import {Menu} from "@lumino/widgets";
import {displayAlert, displaySearchParams} from "./popups";

let ecosml_server = '';
var valuesUrl = new URL(PageConfig.getBaseUrl() + 'maapsec/environment');

request('get', valuesUrl.href).then((res: RequestResult) => {
    if (res.ok) {
        let environment = JSON.parse(res.data);
        ecosml_server = window.location.protocol + "//" + window.location.hostname + ":" + environment['ecosml_proxy_port'];
        console.log("Setting ecosml url as: ", ecosml_server)
    }
});
/**
 * Initialization data for the ecosml_iframe_extension extension.
 */
const extension: JupyterFrontEndPlugin<WidgetTracker<IFrameWidget>> = {
    id: 'ecosml_iframe_extension:plugin',
    autoStart: true,
    requires: [IMainMenu, ICommandPalette, ILauncher],
    activate: (app: JupyterFrontEnd,
               mainMenu: IMainMenu,
               palette: ICommandPalette,
               launcher: ILauncher): WidgetTracker<IFrameWidget> => {
        let widget: IFrameWidget;
        const namespace = 'ecosml-tracker-iframe';
        let instanceTracker = new WidgetTracker<IFrameWidget>({ namespace });
        let ecosml_url = ecosml_server
        console.log("Ecosml URL", ecosml_url)
        //
        // Listen for messages being sent by the iframe - parse the url and set as parameters for search
        //
        window.addEventListener("message", (event: MessageEvent) => {
            // if the message sent is the edsc url
            if (typeof event.data === "string"){
                ecosml_url = event.data;
                console.log("SSE event", event.data)
            }
        });

        const open_command = 'ecosml:open';
        app.commands.addCommand(open_command, {
            label: 'Open EcoSML',
            isEnabled: () => true,
            execute: args => {
                console.log("Open iframe ecosml", ecosml_server)
                if (widget == undefined) {
                    widget = new IFrameWidget(ecosml_server);
                    app.shell.add(widget, 'main');
                    app.shell.activateById(widget.id);
                } else {
                    // if user already has EDSC, just switch to tab
                    app.shell.add(widget, 'main');
                    app.shell.activateById(widget.id);
                }

                if (!instanceTracker.has(widget)) {
                    // Track the state of the widget for later restoration
                    instanceTracker.add(widget);
                }
                console.log(widget)
            }
        });
        palette.addItem({command: open_command, category: "EcoSML"})

        const display_params_command = 'ecosml:displayParams';
        app.commands.addCommand(display_params_command, {
            label: 'View Selected Model Package',
            isEnabled: () => true,
            execute: args => {
                displayParams(ecosml_url)
            }});

        const { commands } = app
        let searchMenu = new Menu({commands});
        searchMenu.title.label = "EcoSML Search";
        searchMenu.addItem({command: open_command})
        searchMenu.addItem({command: display_params_command})
        mainMenu.addMenu(searchMenu, {rank: 90})
        if (launcher) {
            launcher.add({
                command: open_command,
                category: 'EcoSML',
                rank: 1
            })
        }
        console.log('JupyterLab extension ecosml_iframe_extension is activated!');
        return instanceTracker

    }
};

export default extension;

function displayParams(urlstring: string) {
    try {
        var packageURL = new URL(urlstring)
        console.log("URL", packageURL)
        var packageData = null
        if (packageURL.origin.includes(ecosml_server)) {
            if (packageURL.pathname.includes("/package")) {
                var packageName: any = packageURL.pathname.split("/").pop()
                var apiURL = "/api" + packageURL.pathname;
                var packageURI = new URL(apiURL, packageURL.origin).href;
                request("get", packageURI).then((res:RequestResult) => {
                    if (res.ok) {
                        packageData = JSON.parse(res.data)
                        console.log("EcoSML Package data ", packageData)
                        return displaySearchParams(packageName, packageURI, packageData)
                    }
                })
            }
        }
    } catch (e) {
        console.log(e)
        displayAlert("Could not parse url data. <br/> " +
            "Please make sure to select a package on EcoSIS and copy the url. <br/>" +
            "Currently url: "+ urlstring)
    }
}
