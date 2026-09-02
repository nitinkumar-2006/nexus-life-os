// src/components/CameraCapture.jsx
//
// A globally reusable in-app camera trigger. A real, confirmed side-by-
// side comparison against ChatGPT's own mobile app (two screenshots) -
// tapping "Camera" there doesn't open a custom in-page viewfinder built
// out of getUserMedia at all: it launches the DEVICE'S OWN native camera
// app (the shutter button, back arrow, and "more options" glyph in that
// screenshot are literally the phone's stock camera UI, not anything
// ChatGPT drew itself). The exact web equivalent of that native camera-
// app launch is `<input type="file" accept="image/*" capture="environment">`
// - the browser hands off to the OS's own camera app the same way a
// native app's camera intent would, complete with the OS's own capture/
// retake/confirm flow already built in, then returns the photo. That's
// what this component does - no custom viewfinder, no getUserMedia
// permission prompt of its own, nothing rendered on screen at all; it's
// a thin, reusable trigger any part of the app can drop in to get
// "exactly ChatGPT's Camera button" behavior for free.
//
// Exposes an imperative `open()` via ref instead of an `isOpen` prop - a
// real, confirmed bug: this used to trigger the hidden input's .click()
// from a useEffect that fired after `isOpen` flipped true via React
// state. That state update (and the effect reacting to it) happens on a
// LATER tick than the original tap, by which point strict mobile
// browsers (notably iOS Safari) have already expired the tap's "user
// activation" - .click() on a file/camera input silently does nothing
// without an active, synchronous user gesture. Calling open() directly
// from the button's own onClick keeps the whole chain (tap -> open() ->
// input.click()) inside that same original gesture, which is what
// actually launches the native camera reliably.
import { forwardRef, useImperativeHandle, useRef } from 'react';

const CameraCapture = forwardRef(({ onCapture }, ref) => {
    const inputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        open: () => inputRef.current?.click(),
    }), []);

    const handleChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allows capturing again immediately after
        if (file) onCapture(file);
    };

    return (
        <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleChange}
            tabIndex={-1}
            aria-hidden="true"
        />
    );
});

export default CameraCapture;
