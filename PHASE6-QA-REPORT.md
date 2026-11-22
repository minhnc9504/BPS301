# BPMS · Báo cáo QA Phase 6

Ngày kiểm tra 22/11/2026. Kiểm tra trên Windows, Node.js 24, Chrome headless và bản build tĩnh dưới `/BPS301/`. Mọi thao tác ghi, nhập và khôi phục trên trình duyệt đều dùng hồ sơ QA tách riêng.

## 1. Hiện trạng

Repository có các màn hình Tổng quan, Giáo trình, Ôn tập, Thi thử, Ngân hàng và Cài đặt. Mã nguồn Phase 5 có báo cáo theo câu, Lecture và chủ đề, lịch sử thi, cùng luồng ôn từ kết quả. Danh mục hiện tại có 6 bộ đề với 310 câu, 11 Lecture, 48 mục chính và 32 mục bổ sung. 11 PDF có tổng 485 trang và chiếm 37.44 MB trên đĩa. ID, đáp án, ảnh logo và tài liệu gốc giữ nguyên.

## 2. Lỗi, mức độ và cách sửa

| Mức độ | Vấn đề | Cách sửa |
| --- | --- | --- |
| High | Hai tab có thể cùng ghi từ bản sao cũ. Thay đổi ở tab này có thể ghi đè lượt ôn, dấu câu khó hoặc tiến độ của tab kia. | Dùng Web Locks theo origin để tuần tự hóa thao tác đọc, cập nhật và ghi. Mỗi thao tác tính trạng thái mới từ dữ liệu vừa đọc. Tab khác nhận thông báo `storage` rồi đọc lại bên trong khóa. |
| High | Phiên thi được lưu bằng cả đối tượng lấy từ UI. Chuyển câu hoặc đánh dấu trong một tab có thể ghi đè lựa chọn ở tab khác. | Áp dụng thay đổi riêng lên phiên mới nhất trong khóa. Khi nộp, chỉ xử lý phiên còn tồn tại. Câu nhiều đáp án áp dụng thay đổi từng lựa chọn trên dữ liệu mới nhất. |
| Medium | Chế độ khôi phục ghi đè có thể được thực hiện từ bản xem trước chỉ với một lần bấm xác nhận. | Thêm hộp thoại xác nhận ghi đè. Gộp dữ liệu sử dụng trạng thái mới nhất trong khóa và giữ ưu tiên dữ liệu cục bộ khi trùng. |
| Medium | Bản lịch sử cũ thiếu thời điểm nộp bị từ chối dù dữ liệu nằm trong danh sách lịch sử. | Chấp nhận thời điểm nộp bị thiếu trong lịch sử. Phiên đang thi vẫn bị từ chối nếu có trường thể hiện đã kết thúc. Báo cáo cũ hiển thị thời điểm chưa có dữ liệu. |
| Medium | Các điểm nhập đọc toàn bộ JSON vào bộ nhớ trước khi kiểm tra dung lượng. | Kiểm tra tên tệp và giới hạn 10 MiB trước khi đọc. Ngân hàng cũng giới hạn tổng dung lượng của nhóm tệp đang chọn. Hỗ trợ BOM và thông báo lỗi cú pháp bằng tiếng Việt. |
| Medium | Mã Thi thử được tải lúc vào Tổng quan và Ngân hàng dựng toàn bộ kết quả tìm kiếm ngay. | Tải mô-đun Thi thử khi sử dụng. Ngân hàng dựng lần lượt theo nhóm 30 câu và để người dùng mở thêm. Giữ Ngân hàng trong gói khởi tạo sau khi thử tách riêng làm thời gian mở màn hình tăng rõ. |

## 3. Tệp và kiểm thử bổ sung

- Điều phối và dữ liệu: `src/App.tsx`, `src/data/localStudy.ts`, `src/data/storage.ts`, `src/data/backup.ts`, `src/data/model.ts`, `src/data/jsonFile.ts`.
- Giao diện ghi dữ liệu: `src/components/Question.tsx`, `src/features/Bank.tsx`, `CurriculumPage.tsx`, `DocumentUpload.tsx`, `Exam.tsx`, `ExamUpload.tsx`, `Library.tsx`, `Practice.tsx`, `SourceLinks.tsx`.
- Tài liệu cập nhật: `README.md` và báo cáo này.
- Kiểm thử mới: `tests/data-safety.test.mjs` kiểm tra migration, quota và rollback, dữ liệu hỏng hoặc trùng, backup cũ, khôi phục theo phạm vi, tệp JSON quá lớn và đường dẫn tài liệu nguy hiểm. `tests/e2e/multi-tab.mjs` kiểm tra phiên thi, trạng thái học, đồng bộ liên tab, giao diện responsive và khôi phục.
- Chạy `npm test` và `npm run build`. Để chạy kiểm thử trình duyệt trong repository, cung cấp Playwright Core và Chromium. Dùng `node tests/e2e/multi-tab.mjs` sau khi build. Có thể đặt `BPMS_PLAYWRIGHT_MODULE` trỏ tới mô-đun Playwright có sẵn và `BPMS_CHROME` trỏ tới Chrome cài trên máy.

## 4. Kết quả build và hồi quy

- TypeScript và `npm run build` thành công. Unit test **20/20**.
- Kịch bản cạnh tranh hai tab tái hiện lỗi trên bản nền bằng cách giữ lại thông báo `storage` để mỗi tab tiếp tục nhìn trạng thái cũ. Bản sửa giữ lượt ôn, dấu câu khó và tiến độ Giáo trình qua F5. Hai tab trả lời hai câu khác nhau trong cùng phiên đều được lưu. Hai thao tác chọn khác nhau trên cùng câu ôn nhiều đáp án cũng được giữ. Hai lượt nộp cùng lúc tạo một kết quả trong lịch sử.
- Cấu hình bản tĩnh xuất `404.html`, logo, manifest và 11 PDF. Chrome mở trang PDF được yêu cầu trên localhost và bản mô phỏng Pages. Các kiểm tra này chạy trên máy cục bộ.
- Merge giữ kết quả, metadata và nguồn đã xác minh. Sao lưu thông thường lưu tham chiếu tới tệp IndexedDB. Khi sang hồ sơ khác, trình xem báo thiếu tệp và cho gắn lại tệp gốc. Unit test mô phỏng lỗi quota khi ghi tiến độ và kiểm tra rollback của khóa bộ đề.
- Quét chuỗi thường gặp của PAT, khóa AWS, khóa OpenAI và private key trong cây làm việc không có kết quả khớp. Đây là kiểm tra theo mẫu, chưa bao gồm toàn bộ lịch sử Git.

### Kiểm tra trên trình duyệt

| Khu vực | Ca được kiểm tra |
| --- | --- |
| Tổng quan | Hồ sơ mới và có tiến độ, KPI, hành động tiếp tục Ôn tập hoặc Thi thử, loại phiên hết hạn khỏi ô tiếp tục, logo, ba kích thước hiển thị. |
| Giáo trình | 11 Lecture, tìm kiếm, đánh dấu đã học, F5, tiếp tục từ Tổng quan, chuyển sang Ôn tập và quay lại, drawer mobile. |
| Ôn tập | Một và nhiều lựa chọn, phản hồi, giải thích, dấu câu khó, lịch ôn và đến hạn, bộ lọc, khôi phục và quay lại Giáo trình. |
| Thi thử | Tạo phiên, F5, nộp tay, tự nộp hết giờ, câu bỏ trống, điểm từ snapshot, mở lời giải và PDF, ôn từ câu sai, lịch sử, so sánh và khôi phục kết quả. |
| Ngân hàng | JSON lỗi, mẫu tải xuống, thông tin đề nhập, trùng ID, sao lưu và gỡ đề trên hồ sơ QA. |
| Slide Viewer | 485 trang, mở đúng trang, bàn phím, phóng to, toàn màn hình, nguồn xác minh hoặc gợi ý, tệp hỏng, tệp thiếu và gắn lại. |
| Cài đặt và dữ liệu | Theme, hộp thoại bàn phím, tải bản sao lưu, JSON lỗi, xem trước bản cũ, hủy và xác nhận ghi đè, loại thẻ script, handler và URL JavaScript khỏi HTML câu hỏi. |

## 5. Hiệu năng trước và sau

Trung vị 5 lần mỗi bản trong Chrome headless trên cùng máy, mỗi lần dùng trang và hồ sơ mới, chặn font từ xa. Thời gian giao diện tính tới lúc phần tử mục tiêu xuất hiện. Kết quả đo cục bộ có dao động theo cache và tải hệ thống.

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| JavaScript khởi tạo, kích thước chưa nén | 424,480 B | 401,134 B |
| JavaScript khởi tạo, gzip của Vite | 135.00 kB | 128.24 kB |
| Mở Tổng quan tới khi có KPI | 312 ms | 264 ms |
| Mở Ngân hàng đến vùng có thể tìm câu | 145 ms | 119 ms |
| Mở trang PDF 5 từ Giáo trình | 514 ms | 490 ms |
| Chuyển trang PDF 5 sang 6 | 226 ms | 233 ms |
| Heap JS tại Tổng quan, chỉ số xấp xỉ của Chromium | 7.48 MB | 7.51 MB |
| PDF được yêu cầu khi mở Tổng quan | 0 | 0 |
| Dung lượng localStorage khi bắt đầu hồ sơ mới | 0 B | 0 B |

Mức giảm JS khởi tạo khoảng 5.5%. Trung vị chuyển trang và heap tăng nhẹ trong phép thử. Các số liệu này ghi nhận trước bản sửa nhỏ cuối cùng cho đường xuất backup. Bản build cuối báo 128.25 kB gzip cho gói khởi tạo. Chưa có số liệu tải mạng thực tế của GitHub Pages, bộ nhớ dài hạn hoặc mức sử dụng IndexedDB với kho tài liệu lớn.

## 6. Rủi ro còn lại và điều kiện phát hành

- Cơ chế ghi an toàn yêu cầu Web Locks và chạy qua HTTPS hoặc localhost. Trong môi trường thiếu Web Locks, ứng dụng báo lỗi khi ghi. Nên tải lại tab đang mở bản cũ, vì bản cũ chưa tham gia khóa chung.
- Khi hai người thao tác trên cùng một câu ở cùng phiên, lựa chọn một đáp án theo thứ tự nhận khóa. Các câu khác nhau và các lựa chọn riêng của câu nhiều đáp án được áp dụng độc lập.
- Hai khóa localStorage vẫn là hai lần ghi. Ứng dụng rollback khi ghi thất bại trong quá trình thực thi thông thường. Việc trình duyệt hoặc máy bị dừng đúng giữa hai lần ghi chưa có giao dịch bền vững xuyên khóa.
- Đánh giá accessibility thực hiện bằng bàn phím, kích thước viewport và kiểm tra luồng thực tế trong Chrome. Chưa chứng nhận WCAG bằng trình đọc màn hình hoặc kiểm thử đủ các trình duyệt.

**Đánh giá** · Đủ điều kiện để thử phát hành nội bộ trên Chrome qua localhost hoặc HTTPS. Kết quả này chưa xác nhận các trình duyệt khác hoặc hành vi trên hosting GitHub Pages thật. Phase 6 dừng ở build và kiểm thử cục bộ.
