import os
import csv
from flask import Flask, render_template, request, jsonify, send_from_directory
import argparse

app = Flask(__name__, static_folder='static', static_url_path='/static')

# 解析命令行参数
parser = argparse.ArgumentParser(description='Run spectrum labeling tool')
parser.add_argument('--star-table', '-s', type=str, default='catalog/remain3.csv', help=f'Path to star table CSV')
parser.add_argument('--port', '-p', type=int, default=5009, help=f'Port to run server')
args = parser.parse_args()

# 初始化路径
STAR_TABLE_FILE = args.star_table
LOG_FILE = os.path.splitext(STAR_TABLE_FILE)[0] + ".log"
FIG_DIR = os.path.abspath("./data/fig_Li_region")
FIG_DIR_2 = os.path.abspath("./data/fig_Halpha_region")

print(f"Using star table: {STAR_TABLE_FILE}")
print(f"Logging to: {LOG_FILE}")

# 加载星表数据
def load_star_table():
    data = []
    if os.path.exists(STAR_TABLE_FILE):
        with open(STAR_TABLE_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'tag' not in row:
                    row['tag'] = '0'
                if 'label' not in row:
                    row['label'] = ''
                if 'notes' not in row:
                    row['notes'] = ''
                data.append(row)
    return data

star_data = load_star_table()
obsids = [int(row['obsid']) for row in star_data] if star_data else []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_initial_data')
def get_initial_data():
    return jsonify({
        "star_data": star_data,
        "total": len(star_data)
    })

@app.route('/get_spectrum/<int:index>')
def get_spectrum(index):
    if index < 0 or index >= len(star_data):
        return jsonify({"error": "Index out of range"}), 404
    
    obsid = obsids[index]
    
    # 检查图片是否存在
    li_img = f"{obsid}_Li_region.jpg" if os.path.exists(os.path.join(FIG_DIR, f"{obsid}_Li_region.jpg")) else None
    halpha_img = f"{obsid}_Halpha_region.jpg" if os.path.exists(os.path.join(FIG_DIR_2, f"{obsid}_Halpha_region.jpg")) else None
    
    notes_str = star_data[index].get('notes', '')
    notes_list = [note.strip() for note in notes_str.split(';') if note.strip()]

    return jsonify({
        "obsid": obsid,
        "li_img": li_img,
        "halpha_img": halpha_img,
        "label": star_data[index]['label'],
        "tag_count": star_data[index]['tag'],
        "notes": notes_list,
        "total": len(star_data),
        "position": index + 1
    })

@app.route('/images/<path:filename>')
def serve_image(filename):
    try:
        if filename.endswith("_Li_region.jpg"):
            return send_from_directory(FIG_DIR, filename)
        elif filename.endswith("_Halpha_region.jpg"):
            return send_from_directory(FIG_DIR_2, filename)
        return "Invalid filename", 404
    except Exception as e:
        print(f"图片加载错误: {str(e)}")
        return str(e), 500
    
@app.route('/save_label', methods=['POST'])
def save_label():
    try:
        data = request.json
        label = data.get('label')
        notes = data.get('notes', [])
        obsid = data.get('obsid')
        
        if not obsid:
            return jsonify({"error": "No obsid provided"}), 400

        # 找到实际索引
        actual_index = next((i for i, row in enumerate(star_data) 
                          if int(row['obsid']) == int(obsid)), None)
        
        if actual_index is None:
            return jsonify({"error": "Invalid obsid"}), 400
        
        # 更新数据
        new_tag = str(int(star_data[actual_index]['tag']) + 1 if star_data[actual_index]['tag'] != '0' else '1')
        notes_str = ';'.join(notes) if notes else ''
        
        # 写入日志
        with open(LOG_FILE, 'a') as f:
            f.write(f"{obsid},{label},{notes_str},{new_tag}\n")
        
        # 更新内存数据
        star_data[actual_index]['label'] = label
        star_data[actual_index]['tag'] = new_tag
        star_data[actual_index]['notes'] = notes_str
        print('Note is : ----> ', notes_str)
        
        # 更新CSV文件
        with open(STAR_TABLE_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=star_data[0].keys())
            writer.writeheader()
            writer.writerows(star_data)
        
        return jsonify({
            "status": "success",
            "new_tag": new_tag,
            "label": label,
            "updated_data": star_data,
            "notes": notes_str
        })
        
    except Exception as e:
        print(f"保存标签错误: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
@app.route('/get_shared_last_obsid')
def get_shared_last_obsid():
    if not os.path.exists(LOG_FILE):
        return jsonify({"last_obsid": None})

    try:
        with open(LOG_FILE, 'r') as f:
            lines = f.readlines()
            if not lines:
                return jsonify({"last_obsid": None})

            last_line = lines[-1].strip()
            obsid = last_line.split(',')[0]
            return jsonify({"last_obsid": obsid})
    except Exception as e:
        print(f"[ERROR] Failed to read log: {e}")
        return jsonify({"last_obsid": None})
        

@app.route('/debug')
def debug():
    return jsonify({
        "static_folder": app.static_folder,
        "fig1_exists": os.path.exists(FIG_DIR),
        "fig2_exists": os.path.exists(FIG_DIR_2),
        "csv_exists": os.path.exists(STAR_TABLE_FILE),
        "log_exists": os.path.exists(LOG_FILE),
        "star_data_count": len(star_data)
    })

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=args.port, debug=True)
