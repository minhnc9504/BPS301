# Smart Exam Preparation System

[![Live Demo](https://shields.io)](https://minhnc9504.github.io/BPS301/home)
![React](https://shields.io)
![Vite](https://shields.io)

**Smart Exam** là ứng dụng web ôn tập và thi thử trắc nghiệm được xây dựng bằng **React**, **TypeScript** và **Vite**. Ứng dụng sử dụng giao diện tiếng Việt, giữ nguyên ngôn ngữ gốc của câu hỏi và tài liệu, đọc dữ liệu từ các tệp JSON tĩnh và lưu toàn bộ tiến độ học tập trên `localStorage` của trình duyệt.

> **Trải nghiệm trực tuyến:** [https://minhnc9504.github.io/BPS301/home](https://minhnc9504.github.io/BPS301/home)

---

## Chạy dự án trên máy (Local)

**Yêu cầu:** Node.js `22.12+` và `npm`.

```bash
# Cài đặt thư viện
npm ci

# Chạy môi trường phát triển
npm run dev
```

Mở địa chỉ hiển thị trên terminal (thường là `http://localhost:5173`).

**Kiểm tra bản đóng gói (Production):**

```bash
npm run build   # Kiểm tra TypeScript và xuất tệp ra thư mục dist/
npm run preview # Xem trước bản build trên máy
```

---

## Tính năng chính

| Mục | Chức năng |
| :--- | :--- |
| **Tổng quan** | Xem thống kê tiến độ, lịch sử học tập và tiếp tục nhanh tại vị trí đang làm dở. |
| **Ôn tập** | Lọc câu hỏi theo đề, chương, chủ đề hoặc danh sách câu cần ôn lại. Tự động lưu đáp án và phản hồi khi chuyển câu/tải lại trang. Hỗ trợ **Làm lại** từng câu hoặc **Reset tiến độ** theo bộ lọc (vẫn giữ dấu câu khó). |
| **Thi thử** | Tùy chỉnh đề thi, số lượng câu, thời gian làm bài và chế độ trộn câu hỏi/đáp án. Đồng hồ đếm ngược chạy ngầm ngay cả khi chuyển đề hoặc đóng tab; tự động nộp bài nếu hết giờ khi mở lại ứng dụng. |
| **Giáo trình** | Đọc lý thuyết, tìm kiếm theo tiêu đề hoặc nội dung trang đã khai báo; hỗ trợ xem PDF, ảnh slide (tệp `.pptx` sử dụng PDF hoặc bộ ảnh đi kèm để xem trước). |
| **Ngân hàng** | Nhập một hoặc nhiều tệp JSON, tự động kiểm tra lỗi cú pháp và trùng lặp ID (cho phép bỏ qua, cập nhật hoặc tạo bản sao). Hỗ trợ chỉnh sửa trực tiếp câu hỏi, gắn trang giáo trình và xuất dữ liệu. |

### Tiện ích & Sao lưu dữ liệu
* **Phím tắt & Giao diện:** Nhấn **Tìm nhanh** hoặc `Ctrl + K` (`⌘ + K` trên macOS) để mở nhanh màn hình/chương; chuyển đổi giao diện Sáng/Tối ở góc thanh điều hướng.
* **Sao lưu & Khôi phục:** Xuất toàn bộ dữ liệu hoặc chỉ tiến độ. Mở bản xem trước rồi chọn gộp hoặc ghi đè theo phạm vi tệp. Khi gộp, ứng dụng ưu tiên dữ liệu trên máy ở các ID trùng và hợp nhất lịch sử. **Xuất ngân hàng** tải riêng bộ đề BPS301.
* **Đặt lại & tùy chọn:** Có thể đặt lại lượt ôn và thi, xóa riêng dấu câu khó hoặc khôi phục gốc qua hai lần xác nhận. Tùy chọn tự nộp áp dụng khi tạo phiên thi. Khi tắt tự nộp, bài bị khóa lúc hết giờ và người học nộp thủ công. Dùng `Shift+B` để đánh dấu câu khó và `B` để chọn đáp án B.

---

## Dữ liệu BPS301 đi kèm

Hệ thống tích hợp sẵn **11 chương lý thuyết** và **260 câu hỏi** thuộc 5 bộ đề:

| Tên đề hiển thị | Tệp JSON | Số câu | Ghi chú |
| :--- | :--- | :---: | :--- |
| FA25 | `FA26.json` | 59 | |
| Đề 2 · SU26 FE | `SU26.json` | 48 | |
| FE Mock | `FE_Mock.json` | 3 | |
| BPS301 — FA26 FINAL EXAM 805603 | `BPS301_FA26_FE_805603.json` | 50 | Đáp án, phân tích & mẹo mang tính suy luận tham khảo |
| Ngân hàng 100 câu hỏi ôn tập | `bonus_100c.json` | 100 | |

*(Tên đề hiển thị được lấy từ trường `title` hoặc `exam_title` trong tệp JSON).*

---

## Cấu trúc thư mục

```text
public/
├── data/
│   ├── catalog.json          # Danh mục môn học và đường dẫn tới từng subject.json
│   └── bps301/
│       ├── subject.json      # Khai báo danh sách đề, lý thuyết, chủ đề và giáo trình
│       ├── theory.json       # Nội dung lý thuyết các chương
│       └── exams/            # Các tệp JSON chứa bộ đề trắc nghiệm
├── materials/                # Tài liệu PDF, PPTX và ảnh slide đi kèm dự án
└── smartexam.png             # Logo và favicon

src/
├── components/               # Các component hiển thị câu hỏi và nội dung
├── data/                     # Định nghĩa kiểu dữ liệu, kiểm tra JSON và quản lý localStorage
└── features/                 # Các màn hình chức năng chính
```

---

## Hướng dẫn mở rộng dữ liệu

### 1. Thêm bộ đề mới
* **Dành riêng cho trình duyệt cá nhân:** Vào mục **Ngân hàng** trên giao diện web và nhập tệp JSON.
* **Tích hợp mặc định cho mọi người dùng:**
  1. Đặt tệp JSON vào thư mục `public/data/<ma-mon>/exams/`.
  2. Khai báo đường dẫn `"data/<ma-mon>/exams/<ten-de>.json"` vào mảng `exams` trong tệp `subject.json`.
  3. Tải lại trang (nếu đang chạy `dev`) hoặc `commit` & `push` lên GitHub để cập nhật bản build.

**Quy chuẩn định dạng JSON:**
* **Cấu trúc chuẩn:** Gồm `version: 1`, `subjectId` và mảng `exams`. Mỗi đề chứa `id`, `title`, `questions` (tùy chọn `note`). Mỗi câu hỏi gồm `id`, `type` (`single` hoặc `multiple`), `prompt`, `options` (`id`, `content`) và `answers` (mảng ID đáp án đúng); có thể bổ sung `chapterId`, `topics`, `explanation`, `tip`, `formulas` và `slides`.
* **Hỗ trợ HTML:** Các trường nội dung chấp nhận chuỗi thuần hoặc đối tượng `{ "format": "html", "value": "..." }` (HTML được làm sạch tự động trước khi hiển thị). Có thể dùng tính năng **Xuất ngân hàng** để lấy tệp mẫu đầy đủ.
* **Định dạng tương thích cũ:** Hỗ trợ cấu trúc `exam_title` với `options` dạng object và `type` là `SINGLECHOICE` / `MULTIPLECHOICE` (ID câu được ghép từ tên tệp và ID gốc). *Lưu ý giữ nguyên tên tệp và ID câu hỏi khi cập nhật để không làm mất tiến độ cũ của người dùng.*

### 2. Thêm giáo trình hoặc liên kết slide
1. Đặt tài liệu vào `public/materials/<ma-mon>/<ten-tai-lieu>/`.
2. Khai báo trong mảng `materials` của `subject.json` với các trường: `id`, `title`, `kind` (`pdf`, `pptx` hoặc `images`), `file` (tệp gốc), `preview` (PDF xem trước) và `pages` (`page` bắt đầu từ `1`, `image`, `text` dùng để tìm kiếm từ khóa).
3. Trong câu hỏi JSON, gắn liên kết tới trang tài liệu bằng cú pháp:
   ```json
   "slides": [{ "materialId": "bpm-slides", "page": 1 }]
   ```

> [!NOTE]
> * Tệp tải lên trực tiếp qua giao diện trình duyệt giới hạn tối đa **1,5 MB/tệp** do giới hạn bộ nhớ trình duyệt.
> * Cấu hình Vite sử dụng `base: './'` để chạy ổn định dưới đường dẫn con trên GitHub Pages (`/BPS301/`).
> * Vì ứng dụng chạy hoàn toàn phía client, toàn bộ tệp JSON trong `public/` (bao gồm cả đáp án) đều được phục vụ công khai trên mạng; chế độ **Thi thử** chỉ ẩn đáp án trên giao diện cho đến khi nộp bài.
