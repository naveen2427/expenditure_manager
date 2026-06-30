import os
import secrets
from datetime import datetime, date
from decimal import Decimal
from flask import Flask, request, jsonify, g, make_response
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import csv
import io

from db import init_db, query_db, IS_POSTGRES

app = Flask(__name__)
# Enable CORS for frontend requests on port 5173
CORS(app, resources={r"/api/*": {"origins": "*"}})

from flask.json.provider import DefaultJSONProvider

# Helper to JSON serialize decimal objects and date/datetime objects
class CustomJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return super().default(o)

app.json = CustomJSONProvider(app)


# --- Authentication Middleware Decorator ---
def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        token = None
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        
        # Also support token in query parameter (useful for CSV export downloads)
        if not token:
            token = request.args.get("token")
            
        if not token:
            return jsonify({"error": "Authentication token missing"}), 401
            
        session = query_db(
            "SELECT user_id FROM user_sessions WHERE token = %s",
            (token,),
            one=True
        )
        
        if not session:
            return jsonify({"error": "Invalid or expired session"}), 401
            
        g.user_id = session["user_id"]
        return f(*args, **kwargs)
        
    return decorated_function

# --- API Endpoints ---

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    
    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required"}), 400
        
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400
        
    # Check if user already exists
    existing_user = query_db(
        "SELECT id FROM users WHERE email = %s OR username = %s",
        (email, username),
        one=True
    )
    if existing_user:
        return jsonify({"error": "Email or Username already registered"}), 400
        
    password_hash = generate_password_hash(password)
    
    try:
        query_db(
            "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
            (username, email, password_hash),
            commit=True
        )
        return jsonify({"message": "Registration successful"}), 201
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
        
    user = query_db(
        "SELECT * FROM users WHERE email = %s",
        (email,),
        one=True
    )
    
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401
        
    # Create session token
    token = secrets.token_hex(32)
    query_db(
        "INSERT INTO user_sessions (token, user_id) VALUES (%s, %s)",
        (token, user["id"]),
        commit=True
    )
    
    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    })

@app.route("/api/auth/logout", methods=["POST"])
@login_required
def logout():
    auth_header = request.headers.get("Authorization")
    token = auth_header.split(" ")[1] if auth_header and auth_header.startswith("Bearer ") else None
    if not token:
        token = request.args.get("token")
        
    if token:
        query_db("DELETE FROM user_sessions WHERE token = %s", (token,), commit=True)
        
    return jsonify({"message": "Logged out successfully"})

@app.route("/api/auth/me", methods=["GET"])
@login_required
def me():
    user = query_db(
        "SELECT id, username, email, created_at FROM users WHERE id = %s",
        (g.user_id,),
        one=True
    )
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user})

# --- Categories API ---

@app.route("/api/categories", methods=["GET"])
@login_required
def get_categories():
    categories = query_db(
        "SELECT id, name, type, color, user_id FROM categories WHERE user_id IS NULL OR user_id = %s ORDER BY name ASC",
        (g.user_id,)
    )
    return jsonify(categories)

@app.route("/api/categories", methods=["POST"])
@login_required
def create_category():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    type_ = data.get("type", "")
    color = data.get("color", "#cccccc").strip()
    
    if not name or type_ not in ["income", "expense"]:
        return jsonify({"error": "Valid name and type ('income' or 'expense') are required"}), 400
        
    # Check for duplicate category name for this user
    duplicate = query_db(
        "SELECT id FROM categories WHERE name = %s AND type = %s AND (user_id IS NULL OR user_id = %s)",
        (name, type_, g.user_id),
        one=True
    )
    if duplicate:
        return jsonify({"error": f"Category '{name}' of type '{type_}' already exists."}), 400
        
    try:
        new_id = query_db(
            "INSERT INTO categories (name, type, user_id, color) VALUES (%s, %s, %s, %s)",
            (name, type_, g.user_id, color),
            commit=True
        )
        return jsonify({
            "id": new_id,
            "name": name,
            "type": type_,
            "color": color,
            "user_id": g.user_id
        }), 201
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

# --- Transactions API ---

@app.route("/api/transactions", methods=["GET"])
@login_required
def get_transactions():
    # Filter inputs
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    type_ = request.args.get("type")
    category_id = request.args.get("category_id")
    search = request.args.get("search")
    
    query = """
        SELECT t.id, t.amount, t.type, t.description, t.date, t.created_at, 
               t.category_id, c.name as category_name, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = %s
    """
    params = [g.user_id]
    
    if start_date:
        query += " AND t.date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND t.date <= %s"
        params.append(end_date)
    if type_ in ["income", "expense"]:
        query += " AND t.type = %s"
        params.append(type_)
    if category_id:
        query += " AND t.category_id = %s"
        params.append(category_id)
    if search:
        query += " AND t.description LIKE %s"
        params.append(f"%{search}%")
        
    query += " ORDER BY t.date DESC, t.id DESC"
    
    transactions = query_db(query, tuple(params))
    return jsonify(transactions)

@app.route("/api/transactions", methods=["POST"])
@login_required
def create_transaction():
    data = request.get_json() or {}
    amount = data.get("amount")
    type_ = data.get("type")
    category_id = data.get("category_id")
    description = data.get("description", "").strip()
    date_str = data.get("date")
    
    if amount is None or type_ not in ["income", "expense"] or not date_str:
        return jsonify({"error": "Amount, type ('income' or 'expense'), and date are required"}), 400
        
    try:
        amount_dec = Decimal(str(amount))
        if amount_dec <= 0:
            return jsonify({"error": "Amount must be a positive number"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format"}), 400
        
    try:
        # Validate date string format
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Date must be in YYYY-MM-DD format"}), 400
        
    # Check category exists and is valid for user
    if category_id:
        category = query_db(
            "SELECT id FROM categories WHERE id = %s AND (user_id IS NULL OR user_id = %s) AND type = %s",
            (category_id, g.user_id, type_),
            one=True
        )
        if not category:
            return jsonify({"error": "Invalid category ID or category type mismatch"}), 400
            
    try:
        new_id = query_db(
            "INSERT INTO transactions (user_id, category_id, type, amount, description, date) VALUES (%s, %s, %s, %s, %s, %s)",
            (g.user_id, category_id, type_, amount_dec, description, date_str),
            commit=True
        )
        
        # Return transaction with category details
        created = query_db(
            """
            SELECT t.id, t.amount, t.type, t.description, t.date, t.created_at, 
                   t.category_id, c.name as category_name, c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = %s
            """,
            (new_id,),
            one=True
        )
        return jsonify(created), 201
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
@login_required
def update_transaction(transaction_id):
    # Verify transaction ownership
    tx = query_db(
        "SELECT id FROM transactions WHERE id = %s AND user_id = %s",
        (transaction_id, g.user_id),
        one=True
    )
    if not tx:
        return jsonify({"error": "Transaction not found or access denied"}), 404
        
    data = request.get_json() or {}
    amount = data.get("amount")
    type_ = data.get("type")
    category_id = data.get("category_id")
    description = data.get("description", "").strip()
    date_str = data.get("date")
    
    if amount is None or type_ not in ["income", "expense"] or not date_str:
        return jsonify({"error": "Amount, type ('income' or 'expense'), and date are required"}), 400
        
    try:
        amount_dec = Decimal(str(amount))
        if amount_dec <= 0:
            return jsonify({"error": "Amount must be a positive number"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format"}), 400
        
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Date must be in YYYY-MM-DD format"}), 400
        
    # Check category exists and is valid
    if category_id:
        category = query_db(
            "SELECT id FROM categories WHERE id = %s AND (user_id IS NULL OR user_id = %s) AND type = %s",
            (category_id, g.user_id, type_),
            one=True
        )
        if not category:
            return jsonify({"error": "Invalid category ID or category type mismatch"}), 400
            
    try:
        query_db(
            """
            UPDATE transactions 
            SET amount = %s, type = %s, category_id = %s, description = %s, date = %s
            WHERE id = %s AND user_id = %s
            """,
            (amount_dec, type_, category_id, description, date_str, transaction_id, g.user_id),
            commit=True
        )
        
        updated = query_db(
            """
            SELECT t.id, t.amount, t.type, t.description, t.date, t.created_at, 
                   t.category_id, c.name as category_name, c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = %s
            """,
            (transaction_id,),
            one=True
        )
        return jsonify(updated)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
@login_required
def delete_transaction(transaction_id):
    tx = query_db(
        "SELECT id FROM transactions WHERE id = %s AND user_id = %s",
        (transaction_id, g.user_id),
        one=True
    )
    if not tx:
        return jsonify({"error": "Transaction not found or access denied"}), 404
        
    try:
        query_db(
            "DELETE FROM transactions WHERE id = %s AND user_id = %s",
            (transaction_id, g.user_id),
            commit=True
        )
        return jsonify({"message": "Transaction deleted successfully"})
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

# --- Analytics API ---

@app.route("/api/analytics/monthly", methods=["GET"])
@login_required
def get_monthly_analytics():
    # Summarize income vs expense by month for the current user
    # MySQL query groups by year-month format
    date_format = "TO_CHAR(date, 'YYYY-MM')" if IS_POSTGRES else "DATE_FORMAT(date, '%Y-%m')"
    results = query_db(
        f"""
        SELECT {date_format} as month,
               SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE user_id = %s
        GROUP BY {date_format}
        ORDER BY month ASC
        LIMIT 12
        """,
        (g.user_id,)
    )
    return jsonify(results)

@app.route("/api/analytics/category", methods=["GET"])
@login_required
def get_category_analytics():
    type_ = request.args.get("type", "expense")
    if type_ not in ["income", "expense"]:
        type_ = "expense"
        
    # Group by category name and return sum and colors
    results = query_db(
        """
        SELECT COALESCE(c.name, 'Uncategorized') as name,
               SUM(t.amount) as value,
               COALESCE(c.color, '#9CA3AF') as color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = %s AND t.type = %s
        GROUP BY c.id, c.name, c.color
        ORDER BY value DESC
        """,
        (g.user_id, type_)
    )
    return jsonify(results)

# --- CSV Report Export API ---

@app.route("/api/reports/export", methods=["GET"])
@login_required
def export_csv():
    # Fetch all user's transactions
    transactions = query_db(
        """
        SELECT t.date, t.type, COALESCE(c.name, 'Uncategorized') as category_name, 
               t.amount, t.description
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = %s
        ORDER BY t.date DESC, t.id DESC
        """,
        (g.user_id,)
    )
    
    # Create CSV in memory
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(["Date", "Type", "Category", "Amount", "Description"])
    
    for tx in transactions:
        cw.writerow([
            tx["date"],
            tx["type"].capitalize(),
            tx["category_name"],
            f"{tx['amount']:.2f}",
            tx["description"] or ""
        ])
        
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=financial_report.csv"
    output.headers["Content-type"] = "text/csv"
    return output

if __name__ == "__main__":
    # Setup database structure on startup
    init_db()
    
    # Run the server on host 0.0.0.0 and port 5000
    app.run(host="0.0.0.0", port=5000, debug=True)
