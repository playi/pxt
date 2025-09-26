type Listener = (button: string, visible: boolean) => void;

const listeners: Listener[] = [];

export function onButtonToggle(listener: Listener) {
    listeners.push(listener);
}

export function emitButtonToggle(button: string, visible: boolean) {
    listeners.forEach(l => l(button, visible));
}
