import shuffleArray from 'shuffle-array';

const PARENT = 'nicotb';
const CHARACTER_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
let sessionFetcher;

function generateServiceUserId() {
  const str = shuffleArray(CHARACTER_SET.split(''))
    .slice(0, 10)
    .join('');
  const time = Date.now();
  return `${str}_${time}`;
}

function generateSessionParameter(videoInfo, guestInfo) {
  const sessionAPI = guestInfo.session_api;
  return {
    session: {
      recipe_id: sessionAPI.recipe_id,
      content_id: videoInfo.contentId,
      content_type: 'movie',
      content_src_id_sets: [
        {
          content_src_ids: [
            {
              src_id_to_mux: {
                video_src_ids: videoInfo.videos,
                audio_src_ids: videoInfo.audios
              }
            }
          ]
        }
      ],
      timing_constraint: 'unlimited',
      keep_method: {
        heartbeat: {
          lifetime: 120000
        }
      },
      protocol: {
        name: 'http',
        parameters: {
          http_parameters: {
            parameters: {
              http_output_download_parameters: {}
            }
          }
        }
      },
      content_uri: '',
      session_operation_auth: {
        session_operation_auth_by_signature: {
          token: sessionAPI.token,
          signature: sessionAPI.signature
        }
      },
      content_auth: {
        auth_type: sessionAPI.auth_types.http,
        content_key_timeout: 0,
        service_id: 'nicovideo',
        service_user_id: sessionAPI.service_user_id
      },
      client_info: {
        player_id: sessionAPI.player_id
      },
      priority: 0
    }
  };
}

/**
 * 指定IDの動画情報を取得
 * @param {String} nicoVideoId  sm9的なやつ
 * @returns {Promise.<*|{type, alias, describe}>}
 */
export async function fetchVideoInfo(nicoVideoId) {
  const userId = generateServiceUserId();
  const resp = await fetch(
    `http://embed.nicovideo.jp/play/${nicoVideoId}?parent=${PARENT}&serviceUserId=${userId}`,
    {
      mode: 'cors',
      credentials: 'include'
    }
  );
  return await resp.json();
}

/**
 * 動画情報の取得（昔の動画はこっち）
 * @param {String} nicoVideoId
 * @param {Object} videoInfo
 * @returns {Promise.<{}>}
 */
export async function fetchThumbWatchInfo(nicoVideoId, videoInfo) {
  const resp = await fetch(
    `http://ext.nicovideo.jp/thumb_watch/${nicoVideoId}?k=${
      videoInfo.thumbWatchPlayKey
    }&device=html5_watch`,
    {
      mode: 'cors',
      credentials: 'include'
    }
  );
  const text = await resp.text();
  const result = {};
  text
    .split('&')
    .map(s => s.split('='))
    .forEach(n => {
      result[decodeURIComponent(n[0])] = decodeURIComponent(n[1]);
    });
  return result;
}

/**
 * 動画情報の取得（最近の動画はこっち）
 * @param {String} nicoVideoId
 * @param {Object} videoInfo
 * @returns {Promise.<{}>}
 */
async function fetchGuestWatchInfo(nicoVideoId, videoInfo) {
  const actionTrackID = generateServiceUserId();
  let url = `http://www.nicovideo.jp/api/guest_watch/${nicoVideoId}?frontend_id=70&device=html5_watch`;
  url += `&videos=${encodeURIComponent(videoInfo.videos.join(','))}`;
  url += `&audios=${encodeURIComponent(videoInfo.audios.join(','))}`;
  url += '&protocols=http';
  url += `&skips=${encodeURIComponent(videoInfo.skips.join(','))}`;
  url += `&content_key_timeout=${videoInfo.contentKeyTimeout}`;
  url += `&signature=${encodeURIComponent(videoInfo.watchApiSignature)}`;
  url += `&action_track_id=${encodeURIComponent(actionTrackID)}`;
  url += '&increment_view_counter=true';
  url += '&ver=1';
  url += `&service_user_id=${encodeURIComponent(videoInfo.serviceUserId)}`;
  const resp = await fetch(url, {
    mode: 'cors',
    credentials: 'include'
  });
  const json = await resp.json();
  return json.data;
}

/**
 * *.dmc.nico動画にアクセスするセッションの生成
 * @param videoInfo
 * @param guestInfo
 * @returns {Promise.<void>}
 */
async function createDMCSession(videoInfo, guestInfo) {
  const resp = await fetch(
    `${guestInfo.session_api.api_urls[0]}?_format=json`,
    {
      method: 'post',
      headers: {
        Origin: 'http://embed.nicovideo.jp',
        'content-type': 'application/json'
      },
      body: JSON.stringify(generateSessionParameter(videoInfo, guestInfo)),
      mode: 'cors',
      credentials: 'include'
    }
  );
  const json = await resp.json();
  return json.data;
}

/**
 * *.dmc.nico動画にアクセスするセッションの更新
 * 定期的に叩く
 * @param guestInfo
 * @param dmcSession
 * @returns {Promise.<void>}
 */
export async function updateDMCSession(guestInfo, dmcSession) {
  const resp = await fetch(
    `${guestInfo.session_api.api_urls[0]}/${
      dmcSession.session.id
    }?_format=json&_method=PUT`,
    {
      method: 'post',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(dmcSession),
      mode: 'cors',
      credentials: 'include'
    }
  );
  const json = await resp.json();
  return json.data;
}

/**
 * 包括的にやるやつ
 * @param nicoVideoId
 * @returns {Promise.<*>}
 */
export async function fetchNicoVideo(nicoVideoId) {
  if (sessionFetcher) clearInterval(sessionFetcher);
  sessionFetcher = null;

  const info = await fetchVideoInfo(nicoVideoId);
  if (info.thumbWatchPlayKey) {
    const result = await fetchThumbWatchInfo(nicoVideoId, info);
    console.log(result);
    return {
      type: 'thumbWatch',
      url: result.url,
      ms: {
        url: result.ms,
        thread_id: result.thread_id
      }
    };
  } else if (info.watchApiSignature) {
    const guestInfo = await fetchGuestWatchInfo(nicoVideoId, info);
    const result = await createDMCSession(info, guestInfo);
    console.log(result);
    if (!result) throw '403';
    sessionFetcher = setInterval(() => {
      updateDMCSession(guestInfo, result);
    }, 10000);
    return {
      type: 'guestWatch',
      url: result.session.content_uri,
      ms: {
        url: guestInfo.thread.server_url,
        thread_id: guestInfo.thread.thread_id
      }
    };
  }

  throw new Error('not found');
}
