# BPMS Phase 10 · Kiểm định nội dung BPS301

## Kết quả

Đợt này kiểm kê **310 câu trong 6 bộ đề** và đọc văn bản trích xuất từ **11 PDF, 485 trang**. Các đề xuất và quyết định cục bộ nằm tách khỏi ngân hàng gốc.

| Hạng mục | Số câu | Phạm vi |
| --- | ---: | --- |
| Phân tích bằng parser và truy xuất nội dung | 310 | Schema, câu hỏi, phương án, đáp án đang lưu, các trường giải thích và nguồn. |
| Có đề xuất Lecture mới | 96 | Trong 202 câu thiếu Lecture hợp lệ. 106 câu còn lại giữ chờ phân loại. |
| Có đề xuất chủ đề | 136 | Dùng ID mục hiện hữu trong giáo trình. 174 câu chưa có đề xuất đạt ngưỡng. |
| Có đề xuất trang slide | 12 | Đã đọc đoạn PDF và so sánh với yêu cầu của câu, vẫn chờ người có thẩm quyền duyệt. |
| Có bản nháp mẹo | 110 | Tách mẹo đã nằm trong lời giải hoặc rút câu ngắn từ giải thích gốc. Cần biên tập nếu lời giải gốc còn yếu. |
| Giải thích được đưa vào hàng rà soát | 96 | Gồm mẫu loại trừ lặp lại đáp án, thiếu bối cảnh và một trường hợp cần giới hạn phạm vi diễn giải. Đây là danh sách rà biên tập. |
| Chưa đủ bối cảnh hoặc căn cứ rõ để kết luận về đáp án | 4 | Hai câu viện dẫn Chapter 12 và hai câu RE cần xem lại bản đề. |
| Đáp án có mâu thuẫn đủ rõ để đề xuất đổi | 0 | Chưa kết luận đáp án nào sai. Kết quả này không xác nhận độ chính xác của các câu còn lại. |
| Câu được xác minh bởi người có thẩm quyền | 0 | Ca bấm nút xác minh trong E2E dùng hồ sơ QA riêng. |
| Vẫn thiếu nguồn đã được người có thẩm quyền xác minh | 310 | 298 câu chưa có đề xuất trang đã đối chiếu trực tiếp. 12 câu có trang đề xuất vẫn chờ duyệt. |

## Phương pháp và danh sách duyệt

[Hàng đợi CSV theo từng ID](docs/PHASE10-REVIEW-QUEUE.csv) chứa đề, Lecture đang lưu, đề xuất, trang nếu có, mức tin cậy, yêu cầu kiểm tra hình, bản nháp mẹo và lý do. Bộ tạo [academic-proposals.mjs](scripts/academic-proposals.mjs) đọc PDF gốc bằng PDF.js và tạo [lớp đề xuất JSON](public/data/bps301/academic-proposals.json). Nó dùng văn bản PDF và cụm từ trong câu/đáp án để **gợi ý tra cứu** khi ứng viên có điểm cao nhất duy nhất. Các gợi ý này có mức tin cậy thấp. Chỉ 12 trường hợp có phần dẫn chứng ngữ nghĩa được đọc riêng mới có trang đề xuất. Mức trung bình ở đây thể hiện mức phù hợp của đề xuất, chưa phải xác nhận đáp án. 4 câu được gắn cờ kiểm tra hình/sơ đồ theo chỉ dấu trong văn bản. Quy tắc này chưa phát hiện được mọi câu cần xem hình.

Ví dụ, trang 24 Lecture 2 phân biệt Process Landscape ở Level 1 với mô hình và tác vụ ở tầng dưới. Các trang 38 và 42 Lecture 3 hỗ trợ định nghĩa Pool/Lane và quy tắc luồng qua ranh giới Pool. Các trang 38–39 Lecture 5 mô tả nhóm Machine, Method, Material và Milieu. Trang 33 Lecture 6 có công thức Little và hỗ trợ phép tính trong hai câu. Tài liệu đóng gói và đáp án giữ nguyên.

Các ca cần chủ nội dung quyết định:

- `SU26_FE_41` và `SU26_FE_48` viện dẫn Chapter 12. Chưa có bằng chứng trực tiếp từ 11 PDF, nên hàng đợi không đổi sang Lecture 11 hoặc đề xuất chương thay thế.
- `BPS301_FA26_RE_862083_17` viện dẫn quy trình ở phía trên nhưng bản ghi câu thiếu bối cảnh đó. `BPS301_FA26_RE_862083_20` bị dừng sau cụm *identified business*. Cần kiểm tra bản đề gốc trước khi kết luận.
- `bonus_100c_45` dùng hai ví dụ được liệt kê dưới Method ở trang 38 Lecture 5. Trang 39 cũng liệt kê yếu tố đào tạo dưới Man trong ngữ cảnh lỗi của nhân sự. Người duyệt cần giữ rõ ngữ cảnh trong lời giải.

Đợt này chưa hoàn thành thẩm định ngữ nghĩa từng phương án của toàn bộ 310 câu. Bộ đếm phân tích 310 là số câu đã qua kiểm kê có cấu trúc. Danh sách 96 giải thích là hàng rà biên tập ban đầu. Cần người có thẩm quyền tiếp tục duyệt, đặc biệt với câu mang hình, sử dụng bảng hoặc thiếu bối cảnh.

## Quy trình duyệt trong BPMS

Vào **Ngân hàng → Kiểm định nội dung**. Có thống kê về trường thiếu, tiến độ kiểm định và tranh chấp. Lọc theo đề, Lecture, trạng thái đáp án, tin cậy hoặc trường thiếu. Mỗi câu hiển thị câu hỏi, tất cả phương án, đáp án đang dùng, lời giải gốc và căn cứ đề xuất. Có thể mở PDF, chỉnh metadata, lưu nháp, chấp nhận hoặc từ chối và tải CSV theo bộ lọc.

Chấp nhận metadata tạo lớp phủ cục bộ cho Lecture, chủ đề, mẹo còn thiếu và nguồn gợi ý. Nguồn có thể quản lý riêng ở phần chi tiết câu hỏi. Duyệt đáp án thủ công yêu cầu mở đúng trang, nhập căn cứ và xác nhận thẩm quyền. Trạng thái đối chiếu được gắn với bản câu hỏi, thứ tự phương án và tập đáp án tại thời điểm duyệt. Khi bản đó đổi, cần duyệt lại. Trình duyệt không có hệ thống tài khoản để xác thực thẩm quyền. Đây là lưu vết cục bộ của người duyệt, không phải phê duyệt toàn hệ thống.

Sao lưu toàn bộ mang theo quyết định kiểm định. Bản chỉ tiến độ giữ metadata hiện có của nơi khôi phục. Metadata đã chấp nhận phục vụ bộ lọc và các phiên mới. Bản chụp bài đã nộp, ID câu, nội dung tiếng Anh và cách chấm giữ nguyên.

## Giao diện Ôn tập

[PracticeFeedback.tsx](src/features/PracticeFeedback.tsx) tách dòng đáp án và Sổ tay thành hai phần. [StructuredExplanation.tsx](src/features/StructuredExplanation.tsx) hiển thị trạng thái, giải thích chính, từng phương án sai có căn cứ, lý do kết luận, lưu ý và mẹo. Nguồn và nút xem lý thuyết đứng trước Sổ tay. Lịch sử nằm trong Sổ tay và các thao tác ở cuối. Hai nút chuyển tới cùng một câu đã hợp nhất thành **Câu tiếp**. Lịch ôn, cách chấm và mức thành thạo tiếp tục dùng logic cũ.

[explanationFormatter.ts](src/data/explanationFormatter.ts) ưu tiên nội dung có cấu trúc, nhận nhãn `Loại trừ:`, `Lý do:`, `Mẹo:`, `Nguồn:` và `Lưu ý:` ở ranh giới phù hợp. Văn bản trong ngoặc kép không được dùng làm nhãn. Phân tích phương án dựa vào ID và tập đáp án, với dấu `|` hoặc dòng riêng. Mẹo trùng và các cụm lặp rõ ràng chỉ hiện một lần. HTML, dấu ngoặc chưa đóng, nhãn thiếu nội dung hoặc lặp nhãn mơ hồ giữ nguyên nội dung. Nhóm loại trừ chung được hiển thị nguyên đoạn vì chưa tách được lý do của từng phương án.

- [Ảnh trước Phase 10 — FA25_01, build nền 08d6ca5](docs/screenshots/practice-before-phase10.png)
- [Ảnh sau Phase 10 — FA25_01](docs/screenshots/practice-phase10.png)

## Kiểm thử

`npm run check:release` đạt 35/35 unit test, TypeScript, build và kiểm tra dữ liệu phát hành. Chrome và Edge đều vượt qua E2E Phase 10. Unit test mới bao phủ formatter cũ, Unicode, dấu ngoặc, nhãn thiếu, HTML, đáp án nhiều lựa chọn, trùng nguồn, Lecture/chủ đề hợp lệ, sao lưu và bản chụp bài thi.

[E2E Phase 10](tests/e2e/phase10.mjs) dùng hồ sơ riêng để kiểm tra trạng thái trước/sau trả lời, đúng/sai, câu nhiều đáp án, F5, chuyển câu, lịch ôn, dark mode/mobile, lọc hàng đợi, mở đúng PDF, duyệt thủ công, CSV và bảo toàn snapshot. Không có Git push, deploy hoặc release trong đợt này.


### Tệp triển khai

- Lớp kiểm định: `src/data/academicReview.ts`, `model.ts`, `storage.ts`, `backup.ts`, `scripts/academic-proposals.mjs`, JSON đề xuất và CSV.
- Tích hợp giao diện: `src/App.tsx`, `src/features/Bank.tsx`, `ContentQuality.tsx`, `curriculumData.ts`, `ExamResult.tsx`.
- Phản hồi trong Ôn tập: `src/data/explanationFormatter.ts`, `src/features/Practice.tsx`, `PracticeFeedback.tsx`, `StructuredExplanation.tsx` và `src/styles.css`.
- Kiểm thử: `tests/academic-review.test.mjs`, `tests/explanation-formatter.test.mjs` và `tests/e2e/phase10.mjs`.
