# Smart Exam Preparation System

Smart Exam là ứng dụng ôn tập và thi thử trắc nghiệm chạy trên trình duyệt, dùng React, TypeScript và Vite. Giao diện bằng tiếng Việt, còn câu hỏi và tài liệu giữ ngôn ngữ gốc. Ứng dụng đọc dữ liệu JSON tĩnh và lưu tiến độ trong `localStorage`, nên có thể chạy trên GitHub Pages.

## Chạy trên máy

Dùng **Node.js 22.12+** và npm. Tại thư mục dự án, chạy:

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite hiện trong terminal. Để kiểm tra bản production:

```sh
npm run build
npm run preview
```

Lệnh build kiểm tra TypeScript và tạo thư mục `dist/`.

## Sử dụng ứng dụng

| Mục | Chức năng |
| --- | --- |
| **Tổng quan** | Xem thống kê, lịch sử học và tiếp tục từ vị trí đang làm. |
| **Ôn tập** | Lọc theo đề, chương, chủ đề hoặc câu cần ôn lại. Đáp án và phản hồi được lưu khi chuyển câu hoặc tải lại. **Làm lại** xóa đáp án của câu hiện tại. **Reset tiến độ** xóa đáp án và lượt ôn trong phạm vi đề, chương và chủ đề đang lọc sau khi xác nhận. Dấu câu khó được giữ lại. |
| **Thi thử** | Chọn đề, số câu, thời lượng và cách trộn câu hỏi hoặc lựa chọn. Mỗi đề có thể có một lượt thi đang làm. Đồng hồ tiếp tục chạy khi chuyển đề hoặc đóng tab. Lượt hết giờ được nộp khi ứng dụng chạy lại. Có thể reset lượt đang làm hoặc xóa lịch sử theo từng đề. |
| **Giáo trình** | Đọc lý thuyết, tìm theo tên hoặc nội dung đã khai báo và mở PDF hay ảnh slide. PPTX dùng PDF hoặc ảnh đi kèm để xem trước. |
| **Ngân hàng** | Nhập một hoặc nhiều JSON, xem lỗi và ID trùng, chọn bỏ qua, cập nhật hoặc tạo bản sao. Có thể sửa câu hỏi, gắn trang giáo trình và xuất ngân hàng của môn. |

**Sao lưu** xuất tiến độ ôn tập, các lượt thi đang làm, lịch sử, câu khó và dữ liệu đã thêm hoặc chỉnh sửa trong trình duyệt. **Khôi phục** kiểm tra JSON rồi yêu cầu xác nhận trước khi thay dữ liệu hiện tại. Dùng hai nút này khi chuyển từ localhost sang GitHub Pages hoặc sang thiết bị khác. **Xuất ngân hàng** xuất dữ liệu bộ đề BPS301.

Trên thanh điều hướng, **Tìm nhanh** hoặc `Ctrl+K` (`⌘K` trên Mac) mở danh sách màn hình và chương. Nút mặt trăng hoặc mặt trời đổi giao diện sáng/tối và ghi nhớ lựa chọn trong trình duyệt.

## Dữ liệu BPS301 đi kèm

Danh mục hiện có **11 chương lý thuyết** và **160 câu hỏi** trong bốn bộ đề:

| Đề hiển thị | Tệp JSON | Số câu |
| --- | --- | ---: |
| FA25 | `FA26.json` | 59 |
| Đề 2 · SU26 FE | `SU26.json` | 48 |
| FE Mock | `FE_Mock.json` | 3 |
| BPS301 — FA26 FINAL EXAM 805603 | `BPS301_FA26_FE_805603.json` | 50 |

Tên đề hiển thị lấy từ trường `title` hoặc `exam_title` trong JSON. Bộ đề 805603 đánh dấu đáp án, phân tích và mẹo là nội dung suy luận tham khảo.

## Thêm bộ đề và giáo trình BPS301

```text
public/
  data/catalog.json          # Danh mục môn và đường dẫn đến từng subject.json
  data/bps301/
    subject.json             # Danh sách đề, đường dẫn lý thuyết, chủ đề và giáo trình
    theory.json
    exams/
  materials/                 # PDF, PPTX và ảnh slide đi kèm dự án
  smartexam.png              # Logo và favicon
src/
  features/                  # Các màn hình
  data/                      # Kiểu dữ liệu, kiểm tra JSON và lưu tiến độ
  components/                # Hiển thị câu hỏi và nội dung
```

### Thêm bộ đề cho mọi người

1. Đặt JSON trong `public/data/<mon>/exams/`.
2. Thêm đường dẫn dạng `data/<mon>/exams/<ten-de>.json` vào mảng `exams` của `subject.json`.
3. Tải lại trang khi chạy dev. Với GitHub Pages, commit và push để tạo bản build mới.

Ứng dụng mở trực tiếp BPS301. Các đường dẫn dữ liệu được khai báo trong [cấu hình BPS301](public/data/bps301/subject.json). Để thêm đề cho riêng trình duyệt đang dùng, nhập tệp qua **Ngân hàng**.

JSON chuẩn gồm `version: 1`, `subjectId` và mảng `exams`. Mỗi đề có `id`, `title`, `questions` và có thể có `note`. Mỗi câu có `id`, `type` (`single` hoặc `multiple`), `prompt`, `options` (cặp `id` và `content`) và `answers` (mảng ID lựa chọn đúng). Có thể bổ sung `chapterId`, `topics`, `explanation`, `tip`, `formulas` và `slides`. Nội dung nhận chuỗi văn bản hoặc đối tượng `{ "format": "html", "value": "..." }`; HTML được làm sạch trước khi hiển thị. Dùng **Xuất ngân hàng** để lấy mẫu JSON đầy đủ.

Ứng dụng cũng đọc định dạng `exam_title` với `options` dạng đối tượng và `type` là `SINGLECHOICE` hoặc `MULTIPLECHOICE`. Định dạng này lấy ID đề từ tên tệp và ghép với ID gốc để tạo ID câu. Giữ tên tệp và ID ổn định khi cập nhật để tiến độ cũ tiếp tục khớp.

### Thêm giáo trình hoặc liên kết slide

Đặt tài liệu trong `public/materials/<mon>/<tai-lieu>/`, rồi thêm mục vào mảng `materials` của `subject.json`. Mục cần `id`, `title` và `kind` (`pdf`, `pptx` hoặc `images`). Dùng `file` cho tệp gốc, `preview` cho PDF xem trước và `pages` cho từng trang có `page`, `image` hoặc `text`. Số trang bắt đầu từ 1. Trường `text` cho phép tìm từ khóa theo trang.

Trong câu hỏi, dùng `"slides": [{ "materialId": "bpm-slides", "page": 1 }]` để mở đúng trang. Tệp thêm qua giao diện có giới hạn **1,5 MB mỗi tệp** và dùng dung lượng lưu trữ của trình duyệt.

## Triển khai GitHub Pages

1. Trong repository, vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
2. Commit mã nguồn, `package-lock.json`, dữ liệu trong `public/` và [workflow Pages](.github/workflows/pages.yml), rồi push lên `main`. Workflow chạy `npm ci`, build và xuất bản `dist/`.
3. Mở **Actions → Build and deploy GitHub Pages** để xem kết quả. Có thể bấm **Run workflow** để chạy thủ công. Môi trường `github-pages` hiển thị URL sau khi triển khai thành công.

Vite dùng `base: './'` để tài nguyên tải được khi site nằm dưới đường dẫn repository như `/BPS301/`. Khi triển khai, JSON trong `public/` được phục vụ cùng website, bao gồm đáp án. Chế độ thi thử ẩn đáp án trên giao diện đến khi nộp bài.
