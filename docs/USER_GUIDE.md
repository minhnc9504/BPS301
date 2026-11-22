# Hướng dẫn sử dụng BPMS

[← Về README](../README.md)

## Đọc bài và xem PDF

1. Mở **Giáo trình**, chọn Lecture rồi chọn một mục. Có thể tìm bằng tiêu đề, nội dung hoặc từ khóa.
2. Dùng **Đánh dấu đã học** để lưu tiến độ đọc. Mục **Tiếp tục học** trên Tổng quan có thể đưa bạn về vị trí đã lưu.
3. Trong **Slide nguồn**, chọn **Xem slide**. Dùng nút trang trước/sau hoặc phím ←/→ khi focus nằm trong trình xem. Trình xem có các chế độ vừa trang, vừa chiều rộng và toàn màn hình.
4. Đóng trình xem để quay về mục đang đọc. Khi thấy gợi ý nguồn, hãy kiểm tra nội dung slide trước khi xác minh.
5. Ở **Tệp giáo trình**, bạn có thể nhập PDF, một nhóm ảnh PNG/JPG hoặc PPTX. Ảnh được sắp theo tên tệp. Với PPTX, xuất PDF trên máy rồi dùng **Gắn bản xem trước PDF**. Có thể dùng PowerPoint, LibreOffice Impress hoặc [script PowerShell](../scripts/convert-pptx.ps1) trên Windows có PowerPoint Desktop.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\convert-pptx.ps1 -InputPath '.\bai-giang.pptx' -OutputPath '.\bai-giang.pdf'
```

## Ôn tập

- Từ Giáo trình, chọn **Luyện tập ngay** nếu mục có câu liên quan. Trong tab **Ôn tập**, có thể lọc theo đề, chương, chủ đề hoặc chọn câu sai, câu khó và câu đến hạn.
- Câu một đáp án được kiểm tra khi chọn. Với câu nhiều đáp án, chọn xong rồi bấm **Kiểm tra đáp án**.
- Đọc giải thích, mẹo và nguồn nếu câu có dữ liệu. Dùng **Đánh dấu khó**, **Ôn lại sau** hoặc **Làm lại** khi cần. Lịch ôn lặp lại tính từ các lượt đã kiểm tra và thời điểm ôn lại bạn chọn.
- Nếu bật phím tắt, dùng `1`–`4` hoặc `A`–`D` cho bốn lựa chọn đầu, ←/→ để chuyển câu và `Shift+B` để đổi dấu khó. Dùng `Ctrl+K` hoặc `⌘+K` để mở Tìm nhanh.

## Thi thử và ôn từ báo cáo

1. Chọn bộ đề, số câu, thời gian và cách trộn. Trong lúc thi, bảng câu hỏi hiển thị câu đã chọn, câu bỏ trống và cờ xem lại.
2. Nộp bài để xem điểm, thời gian, kết quả theo Lecture và chủ đề. Có thể nhấp từng câu để xem đáp án tham khảo và lời giải hiện có.
3. Chọn **Ôn lại câu sai** hoặc **Ôn câu sai và bỏ trống**. Nếu câu đã rời ngân hàng, ứng dụng báo số câu thiếu và bạn vẫn có thể đọc nội dung trong báo cáo cũ.
4. Mở **Lịch sử thi** để lọc theo đề, sắp xếp và so sánh các lần thi cùng phạm vi. Số câu và độ khó có thể khác giữa các đề.

## Quản lý câu hỏi và sao lưu

- Trong **Ngân hàng**, dùng **Xuất ngân hàng** để lấy cấu trúc JSON mẫu của dữ liệu đang có. Khi nhập, xem số câu trùng ID rồi chọn bỏ qua, cập nhật hoặc tạo bản sao.
- Khi chỉnh sửa câu hỏi, giữ ID nếu muốn giữ liên kết tiến độ. Trong chi tiết câu hỏi, mở đúng trang trước khi bấm **Xác minh nguồn**.
- Trước khi đổi máy hoặc trình duyệt, dùng **Sao lưu** và tải riêng các tệp đã nhập. Xem [Dữ liệu và sao lưu](DATA_AND_BACKUP.md) để chọn chế độ khôi phục.
