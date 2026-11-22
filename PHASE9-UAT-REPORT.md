# BPMS Phase 9 · User Acceptance Testing

**Bản kiểm thử:** `1.0.0-rc.1`  
**Ngày kiểm thử:** 22/11/2026  
**Kết luận phát hành công khai:** **BLOCKED**. Bản build có thể dùng để nghiệm thu cục bộ. Chủ dự án còn cần duyệt quyền công khai tài liệu và cách công bố tình trạng xác minh nội dung trước khi đưa lên production.

## 1. Phạm vi và môi trường

Đọc README, bốn hướng dẫn trong `docs/`, báo cáo Phase 6 và Phase 7, mã nguồn các màn hình sử dụng và trạng thái Git. Các thay đổi còn dở từ các phase trước được giữ lại. Chạy `npm run check:release` rồi nghiệm thu bản build bằng `npm run preview -- --host localhost --port 5192 --strictPort` dưới `/BPS301/`.

Mọi lượt làm bài, PDF nhập, ghi nguồn và khôi phục nằm trong hồ sơ QA tách riêng. Môi trường staging được sử dụng là Vite Preview cục bộ. Không có staging riêng được cấp quyền. Tệp PDF giả lập lỗi chỉ tồn tại trong phản hồi mạng của hồ sơ QA. Dữ liệu đóng gói, câu hỏi, đáp án và hồ sơ người dùng thật giữ nguyên.

## 2. Hành trình người học

| Bước | Hành vi và bằng chứng |
| --- | --- |
| 1–2 | Hồ sơ mới mở Tổng quan. Dữ liệu học chưa tồn tại, UI hiển thị trạng thái chưa có bài thi. |
| 3–6 | Mở Lecture 1, đọc mục 1.1 **Business process**, mở đúng trang 5. Quan sát trạng thái tải, kiểm tra canvas có nội dung, chuyển sang trang 6 bằng phím →, đóng bằng Escape và đánh dấu đã học. |
| 7–11 | Đi từ mục Giáo trình sang danh sách luyện tập và quay lại đúng mục. Làm sai câu một đáp án, xem giải thích và mẹo, đánh dấu khó, đặt lịch ôn. Làm đúng câu nhiều đáp án bằng thao tác chọn rồi bấm kiểm tra. |
| 12–15 | Thi ba câu đầu của FA25, chọn một đúng và một sai, để trống một câu. F5 giữa phiên vẫn giữ lựa chọn. Nộp bài nhận **3,3/10**, kiểm tra phần **Kết quả theo Lecture** và mở lại đúng câu sai trong Ôn tập. |
| 16–18 | Nhập một PDF thật, đóng trình duyệt và mở lại cùng hồ sơ. So sánh trạng thái trước và sau, xác nhận PDF vẫn mở. Xuất backup, khôi phục vào hồ sơ mới, kiểm tra lịch ôn và lịch thi. Ứng dụng báo thiếu nhị phân ở hồ sơ mới, gắn lại tệp gốc thì mở được. |

Bài tự động nằm trong [learner-uat.mjs](tests/e2e/learner-uat.mjs). Cần Playwright Core và Chrome hoặc Edge. Sau khi chạy preview ở địa chỉ trên, đặt `BPMS_CHROME` tới executable, `BPMS_PLAYWRIGHT_MODULE` nếu dùng mô-đun ở ngoài dự án, rồi chạy `node tests/e2e/learner-uat.mjs`. Script giới hạn thao tác ghi ở loopback.

## 3. Trình duyệt và độ bền dữ liệu

Các kích thước đã dùng là 1440 px, 768 px và 390 px. Kiểm tra bố cục Giáo trình không cuộn ngang, dark mode, điều hướng, phím tắt, dialog, PDF Viewer, trạng thái tải, lỗi và rỗng. Đây là viewport tự động trên máy tính. Firefox chưa có bản cài khả dụng, Safari và thiết bị di động thật chưa thử.

- Hai tab ghi gần đồng thời giữ cả thay đổi của từng tab, gồm lựa chọn khác nhau của cùng câu nhiều đáp án. Hai lần nộp cùng một bài tạo đúng một kết quả.
- Bài nâng cấp phục vụ build commit `08d6ca5` rồi chuyển sang RC trên cùng origin HTTPS. Hồ sơ mở lại vẫn giữ lịch sử thi, lịch ôn, tiến độ Giáo trình, nguồn xác minh của QA và PDF trong IndexedDB.
- Thử thiếu Web Locks hiển thị thông báo chỉ đọc và chặn ghi vào cả localStorage lẫn IndexedDB. Backup cũ được kiểm tra tại bước nhập, khôi phục và unit test migration.
- Sau khi nhập PDF Lecture 1, IndexedDB của hồ sơ UAT báo khoảng **5,31 MB**. localStorage khoảng **11 kB** theo chiều dài chuỗi UTF-16. Đã chạy ca giả lập quota của IndexedDB và unit test rollback localStorage. Các phép thử này không phải giới hạn thật của mọi thiết bị.
- PDF thiếu được kiểm tra qua phản hồi HTTP 404 và qua backup sang hồ sơ mới. PDF hỏng được kiểm tra qua phản hồi riêng trả nội dung lỗi. Chrome đã chạy hồi quy PDF lớn, điều hướng, toàn màn hình và gắn lại nhị phân.

## 4. Đối chiếu nội dung

`check:release` đọc cấu trúc từ bản build và xác nhận **6 bộ đề, 310 câu, 11 Lecture, 48 mục chính, 32 mục bổ sung, 11 PDF, 485 trang và 343 tham chiếu slide của các mục**.

| Mức kiểm tra | Kết quả |
| --- | --- |
| Đường dẫn | Manifest khớp 11 tài liệu. Đường dẫn hợp lệ trong bản build. Preview mở và render PDF Lecture 1. |
| Số trang | PDF khớp số trang của Lecture. Cả 343 tham chiếu từ mục Giáo trình đều nằm trong phạm vi trang. |
| Phù hợp về nội dung | Đọc mẫu trực tiếp từ PDF Lecture 1 và đối chiếu mục 1.1 ở trang 5, 7, mục 1.2 ở trang 10. Trang 5 minh họa quy trình đi qua nhiều chức năng đến khách hàng. Trang 7 nêu định nghĩa và ví dụ. Trang 10 đặt câu hỏi theo tiêu chí hiệu suất. Các mẫu khớp mục đọc. Phần còn lại của 343 liên kết chưa được duyệt nội dung từng trang. |
| Xác minh nguồn | Xác minh trong hồ sơ QA chỉ kiểm tra tính năng lưu và mở nguồn. Không có câu hỏi đóng gói nào có con trỏ slide hoặc mục nguồn mà parser nhận được. Cả 310 câu đều thiếu dấu xác minh nguồn trong dữ liệu đóng gói. |

[Danh sách chi tiết theo ID](docs/PHASE9-CONTENT-AUDIT.csv) dùng `1` để đánh dấu cột còn thiếu. Cột `missing_valid_chapter` gồm cả chương trống lẫn giá trị nằm ngoài danh mục. Cột `page_check` ghi `not listed` khi câu không kê trang. Đây là kiểm kê trường dữ liệu, chưa phải thẩm định đáp án.

| Đề | Số câu | Thiếu giải thích | Thiếu mẹo | Thiếu Lecture hợp lệ | Thiếu chủ đề | Thiếu nguồn xác minh |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FA25 | 59 | 0 | 59 | 0 | 59 | 59 |
| SU26 FE | 48 | 0 | 48 | 2 | 48 | 48 |
| FE Mock | 3 | 0 | 3 | 0 | 3 | 3 |
| FA26 FE 805603 | 50 | 0 | 0 | 50 | 50 | 50 |
| Ngân hàng 100 câu | 100 | 0 | 0 | 100 | 100 | 100 |
| FA26 RE 862083 | 50 | 0 | 0 | 50 | 50 | 50 |
| **Tổng** | **310** | **0** | **110** | **202** | **310** | **310** |

Trong 202 câu thiếu Lecture hợp lệ, 200 câu không có trường và hai câu `SU26_FE_41`, `SU26_FE_48` có giá trị `12`. Cả 310 câu chưa có trường trạng thái xác minh đáp án. Quy trình UAT chỉ kiểm tra việc chấm dựa trên đáp án đã đóng gói, chưa xác nhận đáp án học thuật.

## 5. Nhật ký vấn đề và xử lý

| ID | Mức độ | Tái hiện | Mong đợi | Thực tế | Xử lý và kiểm thử lại |
| --- | --- | --- | --- | --- | --- |
| UAT-01 | Medium | Mở Lecture 1 mục 1.1, mở slide 5 khi phản hồi là PDF lỗi. | Thông báo tiếng Việt phân biệt PDF lỗi và PDF thiếu. | PDF hỏng hiện nguyên văn `Invalid PDF structure.` | Sửa trình xem để dịch lỗi định dạng và mật khẩu, giữ thông báo riêng cho 404 và thiếu nhị phân cục bộ. Thêm ca 404 và PDF lỗi vào E2E. Chrome và Edge đều đạt hai ca sau khi sửa. |
| UAT-02 | Medium | Mở danh sách câu theo Lecture hoặc nộp đề có nhiều câu chưa gán chương. | Bảng phân tích có phân nhóm đủ dữ liệu, với thiếu phần nào được ghi rõ. | 202 câu chưa có Lecture hợp lệ. Không có chủ đề đóng gói. UI hiện `Chưa phân loại` hoặc thông báo thiếu chủ đề. | Giữ nguyên dữ liệu và xuất CSV. Chủ nội dung cần phân loại từng câu, duyệt hai mục chương 12 và chạy lại kiểm thử báo cáo. |
| UAT-03 | Medium | Mở lời giải các đề đóng gói rồi tìm nguồn trực tiếp của câu. | Người học nhận biết được khi lời giải đã có nguồn xác minh. | 310 câu chưa có chỉ dẫn nguồn xác minh trong dữ liệu đóng gói và 110 câu thiếu mẹo. UI Ôn tập báo trạng thái nguồn đáp án chưa ghi. | Xuất danh sách để người phụ trách đối chiếu giáo trình và duyệt thủ công. Chưa xác minh thay từ khóa hoặc tự sửa đáp án. |

Chưa phát hiện lỗi chức năng mức Critical hoặc High trong các ca đã chạy. Rà quyền công khai là cổng phê duyệt độc lập với mức độ lỗi sản phẩm.

## 6. Tài liệu và điều kiện phát hành

- Đối chiếu README và bốn hướng dẫn với các luồng đã thử, đặc biệt ôn một/nhiều đáp án, PDF, phạm vi backup, Web Locks và lệnh npm. Kiểm tra 64 liên kết tương đối và anchor cùng bảy ảnh README. Workflow release chỉ kiểm tra, workflow Pages cần thao tác thủ công được duyệt. Thông tin về Firefox/Safari và bản quyền được giữ theo bằng chứng.
- Chủ dự án cần xác nhận quyền đối với mã nguồn, bộ đề và tài liệu bên thứ ba, nhất là quyền công khai 11 PDF. Việc dùng tài liệu để học và quyền công khai cần phê duyệt riêng.
- Chủ nội dung cần duyệt cách công bố chất lượng nguồn và phạm vi phân tích, hoặc bổ sung nguồn/metadata rồi nghiệm thu lại. Staging cục bộ dùng được trong khi chờ duyệt.
## 7. Kết quả cuối

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run check:release` sau khi sửa PDF | Đạt TypeScript, build, 20/20 unit test và kiểm tra dữ liệu, asset, deep link. |
| Hành trình người học và lỗi PDF trên Vite Preview | Chrome 157 và Edge 158 cùng đạt cả hành trình, khôi phục, báo thiếu PDF và báo PDF hỏng bằng tiếng Việt. |
| Hồi quy hai tab và nâng cấp | Chrome và Edge đạt. Các bài so sánh dùng đúng hồ sơ và origin tương ứng. |
| Quyền công khai và thẩm định nội dung | Còn chờ chủ dự án. |

Tệp Phase 9 gồm báo cáo này, `docs/PHASE9-CONTENT-AUDIT.csv`, `tests/e2e/learner-uat.mjs` và phần xử lý lỗi trong `src/features/SlideViewer.tsx`.
