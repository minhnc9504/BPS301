import { useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { type Backup, type BackupScope, type RestoreMode } from '../data/backup'
import { emptyStudy } from '../data/model'
import type { Preferences } from '../data/preferences'
import { Progress } from '../components/Progress'

export type ResetScope = 'activity' | 'bookmarks' | 'all'

export function SettingsPage({ preferences, change, backup, load, exportData, dismiss, restore, reset, bytes }: {
  preferences: Preferences
  change: (change: Partial<Preferences>) => void
  backup?: Backup
  load: () => void
  exportData: (scope: BackupScope) => void
  dismiss: () => void
  restore: (mode: RestoreMode) => void
  reset: (scope: ResetScope) => void
  bytes?: number
}) {
  const [scope, setScope] = useState<BackupScope>('full')
  const [selection, setSelection] = useState<{ backup?: Backup; mode: RestoreMode }>({ mode: 'merge' })
  const mode = backup === selection.backup ? selection.mode : 'merge'
  const data = backup?.data.subjects.bps301 ?? emptyStudy
  const reviewed = new Set([...data.attempts.map((item) => item.questionId),
    ...Object.entries(data.practice).filter(([, response]) => response.correct !== undefined).map(([id]) => id)]).size
  const quota = 5 * 1024 * 1024
  const usage = bytes === undefined ? undefined : (bytes / quota) * 100
  const switches = [
    ['autoAdvance', 'Tự chuyển câu sau khi trả lời đúng'],
    ['explanations', 'Hiện giải thích sau khi kiểm tra đáp án'],
    ['tips', 'Hiện mẹo ghi nhớ sau khi kiểm tra đáp án'],
    ['autoSubmit', 'Tự nộp bài khi hết giờ'],
    ['warning', 'Cảnh báo khi còn dưới 5 phút'],
    ['mixQuestions', 'Trộn thứ tự câu hỏi'],
    ['mixOptions', 'Trộn thứ tự đáp án'],
    ['shortcuts', 'Bật phím tắt bàn phím'],
    ['questionMeta', 'Hiện mã câu hỏi và nguồn chương khi làm bài'],
  ] as const
  return <>
    <h1>Cài đặt &amp; Dữ liệu</h1>
    <section className="panel task">
      <h2>Dữ liệu &amp; Sao lưu</h2>
      <div className="settings-grid">
        <label>Phạm vi sao lưu<select value={scope} onChange={(event) => setScope(event.target.value as BackupScope)}>
          <option value="full">Tất cả dữ liệu</option><option value="progress">Chỉ tiến độ học tập</option>
        </select></label>
        <button onClick={() => exportData(scope)}><Download size={17} /> Sao lưu</button>
        <button onClick={load}><Upload size={17} /> Chọn tệp khôi phục</button>
      </div>
      {backup && <section className="settings-preview task" aria-label="Xem trước bản sao lưu">
        <h3>Xem trước bản sao lưu</h3>
        <p>{backup.scope === 'full' ? 'Tất cả dữ liệu' : 'Chỉ tiến độ học tập'} · {backup.createdAt
          ? new Date(backup.createdAt).toLocaleString('vi-VN') : 'Tệp không ghi ngày sao lưu'}</p>
        <p>{reviewed} câu đã ôn · {data.history.length} bài thi đã nộp · {data.sessions.length} bài đang làm · {data.bookmarks.length} câu khó</p>
        <label>Cách khôi phục<select value={mode} onChange={(event) => setSelection({ backup, mode: event.target.value as RestoreMode })}>
          <option value="merge">Gộp dữ liệu</option><option value="replace">Ghi đè theo phạm vi tệp</option>
        </select></label>
        <p className="muted">{mode === 'merge'
          ? 'Thêm dữ liệu còn thiếu và giữ bản trên máy khi trùng ID. Bài đã nộp được ưu tiên hơn phiên đang làm.'
          : backup.scope === 'progress' ? 'Thay tiến độ, lịch sử và dấu câu khó. Giữ bộ đề, giáo trình và cài đặt trên máy.'
            : 'Thay dữ liệu học và nội dung tự thêm bằng dữ liệu trong tệp. Áp dụng tùy chọn giao diện nếu tệp có lưu.'}</p>
        <div className="row"><button className="primary" onClick={() => restore(mode)}>Xác nhận khôi phục</button><button onClick={dismiss}>Hủy</button></div>
      </section>}
      <div className="task settings-storage">
        <h3>Dung lượng trình duyệt</h3>
        {bytes === undefined || usage === undefined ? <p>Không đọc được dung lượng lưu trữ.</p> : <>
          <p className="mono">{bytes < 1024 * 1024 ? Math.round(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(2) + ' MB'} / khoảng 5 MB</p>
          <Progress value={Math.min(100, usage)} total={100} label="Dung lượng localStorage ước tính" />
          <p className="muted">Ước tính cho địa chỉ website này. Giới hạn thực tế tùy trình duyệt.</p>
          {usage >= 75 && <p role="status">Dung lượng gần đầy. Ảnh slide và tài liệu lớn có thể làm lưu trữ vượt giới hạn.</p>}
        </>}
      </div>
      <div className="settings-reset task">
        <h3>Đặt lại dữ liệu</h3>
        <div className="row spread"><span>Xóa lượt ôn, bài đang thi và lịch sử thi. Giữ dấu câu khó.</span><button onClick={() => reset('activity')}><RotateCcw size={16} /> Đặt lại lượt ôn và thi</button></div>
        <div className="row spread"><span>Chỉ xóa danh sách câu đã đánh dấu khó.</span><button onClick={() => reset('bookmarks')}>Xóa dấu câu khó</button></div>
        <div className="row spread"><span>Xóa tiến độ, dữ liệu tự thêm và tùy chọn trên trình duyệt.</span><button className="danger-button" onClick={() => reset('all')}>Khôi phục gốc</button></div>
      </div>
    </section>
    <section className="panel task">
      <h2>Ôn tập &amp; Thi thử</h2>
      <div className="settings-grid settings-selects">
        <label>Thời gian thi mặc định<select value={preferences.minutes} onChange={(event) => change({ minutes: event.target.value === 'unlimited' ? 'unlimited' : Number(event.target.value) })}>
          {[30, 45, 60].map((value) => <option key={value} value={value}>{value} phút</option>)}<option value="unlimited">Không giới hạn</option>
        </select></label>
        <label>Độ trễ chuyển câu<select disabled={!preferences.autoAdvance} value={preferences.delay} onChange={(event) => change({ delay: Number(event.target.value) })}>
          {[1, 1.5, 2].map((value) => <option key={value} value={value}>{value.toLocaleString('vi-VN')} giây</option>)}
        </select></label>
      </div>
      <div className="settings-switches">
        {switches.map(([key, label]) => <label className="setting-switch" key={key}>
          <span>{label}</span><input type="checkbox" role="switch" checked={preferences[key]} onChange={(event) => change({ [key]: event.target.checked })} />
        </label>)}
      </div>
      <p className="muted">Nếu tắt tự nộp, đồng hồ vẫn dừng bài khi hết giờ. Bạn có thể nộp thủ công để xem kết quả.</p>
    </section>
    <section className="panel task">
      <h2>Giao diện &amp; Hiển thị</h2>
      <div className="settings-grid settings-selects">
        <label>Chế độ màu<select value={preferences.theme} onChange={(event) => change({ theme: event.target.value as Preferences['theme'] })}>
          <option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option>
        </select></label>
        <label>Cỡ chữ câu hỏi và giải thích<select value={preferences.textSize} onChange={(event) => change({ textSize: event.target.value as Preferences['textSize'] })}>
          <option value="small">Nhỏ</option><option value="normal">Chuẩn</option><option value="large">Lớn</option>
        </select></label>
      </div>
    </section>
  </>
}
