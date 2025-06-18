import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useState } from "react";
import { showToast } from "../state/actions";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

export default function Render(props: {
    copyValue: string;
    title: string;
    eventName?: string;
    label?: string | JSX.Element | undefined;
    toastMessage?: string | undefined;
}) {
    const { state } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const copyTimeoutMs = 2500;

    const copyValue = async () => {
        if (props.eventName) pxt.tickEvent(props.eventName);
        if (state.gameState?.joinCode) {
            navigator.clipboard.writeText(props.copyValue);
            setCopySuccessful(true);
            if (props.toastMessage) {
                dispatch(
                    showToast({
                        type: "success",
                        text: props.toastMessage,
                        icon: "✅",
                        timeoutMs: 5000,
                    })
                );
            }
        }
    };

    useEffect(() => {
        if (copySuccessful) {
            let resetCopyTimer = setTimeout(() => {
                setCopySuccessful(false);
            }, copyTimeoutMs);
            return () => {
                clearTimeout(resetCopyTimer);
            };
        }
    }, [copySuccessful]);

    return (
        <button
            onClick={copyValue}
            title={props.title}
            className="tw-flex tw-items-center tw-align-middle"
        >
            {props.label && (
                <span className="tw-mr-1 hover:tw-opacity-80">
                    {props.label}
                </span>
            )}
            {!copySuccessful && (
                <FontAwesomeIcon
                    icon={faCopy as IconProp}
                    className="tw-text-[65%] hover:tw-scale-110 tw-ease-linear tw-duration-[50ms]"
                />
            )}
            {copySuccessful && (
                <FontAwesomeIcon
                    icon={faCheck as IconProp}
                    className="tw-text-[65%] tw-text-green-600"
                />
            )}
        </button>
    );
}
