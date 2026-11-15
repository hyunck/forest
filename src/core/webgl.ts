/** WebGL을 쓸 수 있는지 (카카오톡 인앱 브라우저 등에서 3D를 못 띄우면 대체 화면으로) */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  }
}
