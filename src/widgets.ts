import { Widget } from '@lumino/widgets';
import {PageConfig} from "@jupyterlab/coreutils";
import {INotification} from "jupyterlab_toastify";
import {request, RequestResult} from "./request";

let unique = 0;

//
// Widget to display Earth Data Search Client inside an iframe
//
export
class IFrameWidget extends Widget {

    constructor(path: string) {
        super();
        this.id = path + '-' + unique;
        unique += 1;

        this.title.label = "EcoSML Search";
        this.title.closable = true;

        let div = document.createElement('div');
        div.classList.add('iframe-widget');
        let iframe = document.createElement('iframe');
        iframe.id = "iframeid";
        iframe.src = path;

        div.appendChild(iframe);
        this.node.appendChild(div);
    }
};

//
// Widget to display selected search parameter
//
export
class ParamsPopupWidget extends Widget {

    public currentRelease: string
    public releaseTar: string
    public repoName: string

    constructor(packageName: string, packageURI: string, packageData: any) {
        let body = document.createElement('div');
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        super({ node: body });


        let releases = packageData["releases"];
        this.currentRelease = releases[releases.length-1]["tagName"]
        this.releaseTar = releases[releases.length-1]["tarballUrl"]
        this.repoName = packageData["name"]

        body.innerHTML = "<pre>Package Name: " + this.repoName + "</pre>"
            + "<pre>Package URI: "+packageData["htmlUrl"]+"</pre>"
            + "<pre>Organization: "+packageData["organization"]+"</pre>"
            + "<pre>Owner: "+packageData["owner"]+"</pre>"
            + "<pre>Current Release: "+ this.currentRelease+"</pre>"
            + "<pre>Release URL: "+ this.releaseTar+"</pre>";

        this.getValue = this.getValue.bind(this)
        this.verifyAlgorithm = this.verifyAlgorithm.bind(this)
        this.registerAlgorithm = this.registerAlgorithm.bind(this)
    }

    async getValue() {
        let downloadPath = PageConfig.getOption('serverRoot')
        let downloadEndpoint = "ecosis_iframe_extension/download";
        console.log("In getValue", PageConfig.getBaseUrl(), downloadPath, downloadEndpoint)
        let downloadNotification = await INotification.inProgress("Downloading file: "+ this.repoName);
        let url = new URL(PageConfig.getBaseUrl()+downloadEndpoint)
        let packageURI = new URL(this.releaseTar).href
        let repoPath = null
        request('get', url.href,
            {"packageUri": packageURI, "downloadPath": downloadPath})
            .then((res: RequestResult) => {
                console.log(res)
                if (res.ok) {
                    console.log("Data", res.data)
                    repoPath = res.data
                    INotification.update({
                        toastId: downloadNotification,
                        message: "Download succeed",
                        type: "success",
                        autoClose: 10000
                    });
                    this.verifyAlgorithm(repoPath)
                }
                else {
                    INotification.update({
                        toastId: downloadNotification,
                        message: "Download failed" + res.statusText,
                        type: "error",
                        autoClose: 10000
                    });
                }
            });
    }

    async verifyAlgorithm(packagePath: string) {
        let verifyEndpoint = "ecosml_iframe_extension/verifyAlgorithm"
        let verifyURL = new URL(PageConfig.getBaseUrl()+verifyEndpoint)
        let verifyNotification = await INotification.inProgress(" Verifying Algorithm: " + this.repoName)
        request('get', verifyURL.href,
            {'packagePath': packagePath, repoName: this.repoName})
            .then((res: RequestResult) => {
                console.log(res)
                if (res.ok) {
                    INotification.update({
                        toastId: verifyNotification,
                        message: "Successfully verified algorithm: " + this.repoName,
                        type: 'success',
                        autoClose: 10000
                    });
                    this.registerAlgorithm(res.data)
                }
                else {
                    INotification.update({
                        toastId: verifyNotification,
                        message: "Unable to verify algorithm: " + res.statusText,
                        type: "error",
                        autoClose: 10000
                    });
                }
            })
    }

    async registerAlgorithm(request_json: string) {
        console.log("Reqeuest josn", request_json)
        let registerEndpoint = "ecosml_iframe_extension/registerAlgorithm"
        let registerURL = new URL(PageConfig.getBaseUrl()+registerEndpoint)
        let registerNotification = await INotification.inProgress(" Registering Algorithm: " + this.repoName)
        request('post', registerURL.href, '', request_json)
            .then((res: RequestResult) => {
                console.log("RegisterAlgo", res)
                if(res.ok) {
                    INotification.update({
                        toastId: registerNotification,
                        message: "Successfully sent algorithm for registration. Please check in a few minutes.",
                        type: "success",
                        autoClose: 10000
                    });
                    return
                }
                else {
                    INotification.update({
                        toastId: registerNotification,
                        message: "Error registering algorithm: " + res.statusText,
                        type: "error",
                        autoClose: 10000
                    })
                }
            })
        return
    }
}

//
// Popup widget to display any string message
//
export class FlexiblePopupWidget extends Widget {
    constructor(text:string) {
        let body = document.createElement('div');
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.innerHTML = text;
        super({ node: body });
    }
}
