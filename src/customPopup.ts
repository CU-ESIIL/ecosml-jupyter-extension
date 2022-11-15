import { Dialog } from '@jupyterlab/apputils';
export class DialogEnter<T> extends Dialog<T> {
    constructor(options: Partial<Dialog.IOptions<T>> = {}) {
        super(options);
    }
}
export function showDialogEnter<T>(
    options: Partial<Dialog.IOptions<T>> = {}
): void {
    let dialog = new DialogEnter(options);
    dialog.launch()
    return;
}

export function popupRegistration(b: any, popupTitle: string, okayButtonLabel: string, cancelButtonLabel: string): void {
    showDialogEnter({
        title: popupTitle,
        body: b,
        focusNodeSelector: 'input',
        buttons: [Dialog.okButton({ label: okayButtonLabel}),
            Dialog.cancelButton({ label: cancelButtonLabel })]
    })
}
/* Import this function for your popup needs */
export function popup(b: any, okayButtonLabel: string, cancelButtonLabel: string): void {

    popupRegistration(b, b.popupTitle, okayButtonLabel, cancelButtonLabel);
}
