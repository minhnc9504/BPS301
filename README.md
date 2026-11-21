# Smart Exam Preparation System

Ứng dụng React + TypeScript + Vite. Câu hỏi và lý thuyết BPS301 lấy từ bản HTML gốc `BPS301_Interactive_Quiz_60_Cau.html`. Nguồn có 18 câu và 12 chương; tổng số hiển thị được tính từ tệp dữ liệu.

## Chạy cục bộ

Dùng Node.js 22.12 trở lên.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Trên GitHub, chọn **Settings → Pages → Build and deployment → GitHub Actions**. Workflow `.github/workflows/pages.yml` build `dist/` và triển khai khi push lên `main` hoặc chạy thủ công. Bản build dùng đường dẫn tương đối nên có thể phục vụ dưới thư mục của repository.

## Thêm môn, câu hỏi và giáo trình

1. Tạo cấu hình môn theo mẫu `public/data/bps301/subject.json` rồi thêm đường dẫn vào `public/data/catalog.json`. Đường dẫn cấu hình và dữ liệu bắt đầu với `data/`. Thêm JSON lý thuyết và đề vào các đường dẫn được khai báo trong cấu hình.
2. Mỗi file đề có `version: 1`, `subjectId` và mảng `exams`. Mỗi đề có `id`, `title`, `questions`. ID câu phải duy nhất trong môn. Câu có `type` là `single` hoặc `multiple`, `prompt`, `options` (mỗi option có `id` và `content`), `answers` (mảng ID option đúng). `chapterId`, `topics`, `explanation`, `tip`, `formulas` và `slides` là tùy chọn. Nội dung có cấu trúc `{ "format": "text", "value": "…" }`; định dạng `html` được sanitize trước khi hiển thị. Có thể dùng nút **Xuất ngân hàng** để lấy mẫu.
3. Đặt PDF, PPTX hoặc ảnh vào `public/materials/<mon>/<tai-lieu>/`. Khai báo trong `subject.json` với ID, tên, loại và đường dẫn tương đối. Ví dụ:

```json
{
  "id": "bpm-slides",
  "title": "BPM Slides",
  "kind": "pptx",
  "file": "materials/bps301/bpm/slides.pptx",
  "preview": "materials/bps301/bpm/slides.pdf",
  "pages": [{ "page": 1, "text": "Business Process Management" }]
}
```

   Dùng loại `pdf` cho PDF gốc, hoặc `images` với danh sách trang có trường `image`. Trường `text` theo trang hỗ trợ tìm kiếm. Câu hỏi liên kết qua `slides: [{ "materialId": "bpm-slides", "page": 1 }]`. PPTX cần PDF hoặc ảnh đi kèm để xem trong ứng dụng. PDF mở bằng trình xem của trình duyệt.

## Dữ liệu học

Bản chỉnh sửa, phiên thi, lịch sử, câu khó và tệp nhỏ thêm từ UI lưu trong trình duyệt của thiết bị đang dùng. Dùng **Sao lưu** để chuyển dữ liệu sang trình duyệt khác hoặc trước khi dọn bộ nhớ. **Khôi phục** kiểm tra file và yêu cầu xác nhận trước khi thay dữ liệu học. Phiên thi hết giờ trong lúc đóng tab sẽ được nộp khi mở ứng dụng lại. Khi thi, đáp án bị ẩn trong giao diện; dữ liệu đáp án vẫn nằm trong các tệp tĩnh của ứng dụng.

- Trong **Ôn tập**, đáp án đã chọn, kết quả kiểm tra và vị trí hiện tại được lưu khi chuyển câu hoặc tải lại. **Làm lại** xóa đáp án của câu đang mở. **Reset tiến độ** xóa đáp án và lượt ôn theo giao của đề, chương và chủ đề đang lọc sau khi xác nhận. Các dấu câu khó được giữ lại.
- Trong **Thi thử**, mỗi bộ đề có thể có một lượt thi đang làm. **Chọn bộ đề khác** đưa bạn về màn hình chọn đề trong khi đồng hồ các lượt thi vẫn tiếp tục chạy. Có thể xóa lượt đang làm hoặc xóa lịch sử của riêng từng đề.
- Bản sao lưu bao gồm cả đáp án ôn tập và các lượt thi đang làm. Bản sao lưu cũ vẫn khôi phục được dữ liệu mà phiên bản cũ đã lưu.
