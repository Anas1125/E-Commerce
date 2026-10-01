import { useCallback, useState } from "react";
function useAdminNotice() {
  const [notice, setNotice] = useState(null);
  const notify = useCallback(
    (text, type = "success") => setNotice({ text, type }),
    [],
  );
  const clear = useCallback(() => setNotice(null), []);
  return { notice, notify, clear };
}
export default useAdminNotice;
