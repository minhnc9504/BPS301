# Kiến trúc BPMS

[← Về README](../README.md)

## Luồng dữ liệu

```text
index.html → src/main.tsx → App.tsx → các màn hình features/
                    routes.ts → History API và bộ lọc trên URL
                    storage.ts → danh mục, câu hỏi và lý thuyết JSON
                    localStudy.ts → Web Locks → localStorage
                    documentFiles.ts → IndexedDB
                    SlideViewer.tsx → PDF.js và worker
```

- [App.tsx](../src/App.tsx) kết hợp ngân hàng đóng gói với đề và chỉnh sửa cục bộ. Component dùng [Question.tsx](../src/components/Question.tsx) để hiển thị văn bản và HTML đã lọc.
- [routes.ts](../src/routes.ts) quản lý đường dẫn, query và cấu hình base. Đường dẫn Ôn tập hiện có là `/trainning` và giữ tương thích với `/training`. [404.html](../public/404.html) chuyển tiếp deep link trên Pages và giữ query/hash.
- [review.ts](../src/data/review.ts) tính lịch ôn và thống kê từ lượt trả lời. [examAnalytics.ts](../src/data/examAnalytics.ts) tính báo cáo từ bản chụp phiên thi đã lưu. Bản chụp giữ thứ tự câu hỏi, lựa chọn và các đáp án dùng để chấm.
- [materials-manifest.mjs](../scripts/materials-manifest.mjs) tạo manifest trong dev và build từ `theory.json` cùng các PDF thực. Khi tên PDF không khớp chính xác, manifest chỉ chọn tên thay thế nếu xác định được duy nhất theo số Lecture.

## Thêm dữ liệu đóng gói

- **Câu hỏi:** đặt JSON trong `public/data/bps301/exams/` và khai báo đường dẫn trong [subject.json](../public/data/bps301/subject.json). Dạng chuẩn có `version`, `subjectId` và `exams`. Mỗi câu có `id`, `type`, `prompt`, `options` và `answers`. Parser còn đọc định dạng `exam_title` và `SINGLECHOICE`/`MULTIPLECHOICE`. Dùng **Xuất ngân hàng** để lấy mẫu chuẩn. Giữ ID và tên file ổn định với đề cũ vì chúng có thể tham gia tạo ID.
- **PDF:** đặt trong `public/materials/bps301/` và ưu tiên tên trùng `sourceFile` trong giáo trình, đổi đuôi sang `.pdf`. Đường dẫn manifest đi vào `dist/data/bps301/materials.json` lúc build. Trang liên kết đếm từ 1.
- Sau khi đổi dữ liệu, chạy `npm run check:release`. Đọc [điều kiện phát hành](DEPLOYMENT.md) trước khi đưa tài liệu lên site công khai.

## Kiểm thử

```bash
npm ci
npm test
npm run check:release
```

Bộ E2E tùy chọn cần **Playwright Core** và trình duyệt tương thích. Build trước khi chạy. Nếu dùng Chrome hoặc Edge cài trên máy, đặt `BPMS_CHROME` thành đường dẫn executable. Có thể đặt `BPMS_PLAYWRIGHT_MODULE` nếu Playwright cài ở đường dẫn riêng.

```bash
node tests/e2e/multi-tab.mjs
node tests/e2e/release-upgrade.mjs
```

Bài nâng cấp yêu cầu `BPMS_RELEASE_QA` trỏ tới thư mục kiểm thử có `old/dist/`, `key.pem` và `cert.pem` của HTTPS localhost. Hai bài dùng hồ sơ trình duyệt riêng. Xem kết quả và phạm vi trong [Phase 6](../PHASE6-QA-REPORT.md) và [Phase 7](../PHASE7-RELEASE-REPORT.md).
