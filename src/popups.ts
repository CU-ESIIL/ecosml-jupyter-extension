import {Dialog, showDialog} from "@jupyterlab/apputils";
import {FlexiblePopupWidget, ParamsPopupWidget} from "./widgets";
import {popup} from "./customPopup";

// import {PopupWidget} from "./custom-widget";

export function displaySearchParams(packageName: string, packageURI: string, packageData: any) {
    let paramsPopup = new ParamsPopupWidget(packageName, packageURI, packageData);
    popup(paramsPopup, "Import to ImgSPEC", "Cancel")
  // showDialog({
  //       body: new ParamsPopupWidget(packageName, packageURI, packageData),
  //       focusNodeSelector: 'input',
  //       buttons: [Dialog.okButton({ label: 'Import to ImgSPEC' }), Dialog.cancelButton({label: 'Cancel'})]
  //   });
}

export function downloadSearchParams(packageName: string, packageURI: string) {
  showDialog({
        body: new ParamsPopupWidget(packageName, packageURI, null),
        focusNodeSelector: 'input',
        buttons: [Dialog.okButton({ label: 'Import to ImgSPEC' }), Dialog.cancelButton({label: 'Cancel'})]
    });
}

export function displayAlert(msg: string) {
    showDialog({
        title: 'Alert',
        body: new FlexiblePopupWidget(msg),
        focusNodeSelector: 'input',
        buttons: [Dialog.okButton({ label: 'Dismiss' })]
    })
}
