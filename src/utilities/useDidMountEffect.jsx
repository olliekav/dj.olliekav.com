import { useRef, useEffect } from 'preact/hooks';

const useDidMountEffect = (func, deps) => {
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) func();
    else didMount.current = true;
  }, deps);
}

export default useDidMountEffect;
