/**
 * 함께 있는 방문자(Presence) 확장 포인트 · 제작 지시서 9장
 * ------------------------------------------------------------
 * 이번 시제품은 실시간 동시접속을 구현하지 않습니다. 대신 이 인터페이스를
 * MockPresence(시연용 방문자)로 구현해 두었습니다.
 *
 * 나중에 실제 서버를 붙일 때의 전제 (서버 비용을 줄이기 위한 설계):
 *  - 주고받는 것은 "누가 어디에 있고 어느 자리에 앉아 있는지"뿐입니다.
 *  - 전송 간격은 1~2초에 한 번. 걷는 모습은 받은 위치 사이를 화면에서 보간해 표현합니다.
 *    (ForestGame의 PeerView가 이미 이 방식으로 그립니다)
 *  - 글, 대화, 채팅은 설계에 없습니다. 서로 보이기만 하는 '조용한 동석'입니다.
 *  - 접속자 수를 화면에 숫자로 보여주지 않습니다.
 */
export interface PeerState {
  id: string;
  /** 숲 낱말 이름 (개인 식별 정보 아님) */
  name: string;
  outfit: 'moss' | 'beige' | 'navy' | 'chestnut';
  x: number;
  z: number;
  /** 0 = 땅, 1 = 데크 */
  level: 0 | 1;
  /** 앉아 있는 자리 ID, 걷는 중이면 null */
  seat: string | null;
}

export interface PresenceProvider {
  /** 숲에 들어옴 */
  join(me: PeerState): void;
  /** 숲에서 나감 */
  leave(): void;
  /** 내 위치·자리 알림 (실서버에서는 1~2초 간격으로만 전송) */
  updateSeat(seat: string | null, at: { x: number; z: number; level: 0 | 1 }): void;
  /** 다른 방문자 목록이 바뀔 때마다 호출 */
  onPeersChanged(fn: (peers: PeerState[]) => void): void;
}
